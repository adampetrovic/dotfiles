/**
 * /logseq - Write up the current session to Logseq
 *
 * Extracts the conversation context, generates a structured writeup via LLM,
 * creates a Logseq page, and adds a journal entry for today linking to it.
 */

import { complete, getModel } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOGSEQ_DIR = path.join(os.homedir(), "logseq");
const JOURNALS_DIR = path.join(LOGSEQ_DIR, "journals");
const PAGES_DIR = path.join(LOGSEQ_DIR, "pages");
const LOGSEQ_MODEL_PROVIDER = "openai-codex";
const LOGSEQ_MODEL_ID = "gpt-5.1-codex-mini";
const LOGSEQ_MODEL_LABEL = `${LOGSEQ_MODEL_PROVIDER}/${LOGSEQ_MODEL_ID}`;

type ContentBlock = { type?: string; text?: string; name?: string; arguments?: Record<string, unknown> };
type SessionEntry = { type: string; message?: { role?: string; content?: unknown } };

function extractTextParts(content: unknown): string[] {
	if (typeof content === "string") return [content];
	if (!Array.isArray(content)) return [];
	const parts: string[] = [];
	for (const part of content) {
		if (part && typeof part === "object") {
			const block = part as ContentBlock;
			if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
		}
	}
	return parts;
}

function extractToolCalls(content: unknown): string[] {
	if (!Array.isArray(content)) return [];
	const calls: string[] = [];
	for (const part of content) {
		if (part && typeof part === "object") {
			const block = part as ContentBlock;
			if (block.type === "toolCall" && typeof block.name === "string") {
				const summary = block.name === "Bash"
					? `Tool: ${block.name}` // omit potentially huge bash args
					: `Tool: ${block.name}(${JSON.stringify(block.arguments ?? {}).slice(0, 200)})`;
				calls.push(summary);
			}
		}
	}
	return calls;
}

function buildConversationText(entries: SessionEntry[]): string {
	const sections: string[] = [];
	for (const entry of entries) {
		if (entry.type !== "message" || !entry.message?.role) continue;
		const role = entry.message.role;
		if (role !== "user" && role !== "assistant") continue;

		const lines: string[] = [];
		const textParts = extractTextParts(entry.message.content);
		if (textParts.length > 0) {
			const label = role === "user" ? "User" : "Assistant";
			const text = textParts.join("\n").trim();
			if (text.length > 0) lines.push(`${label}: ${text}`);
		}
		if (role === "assistant") {
			lines.push(...extractToolCalls(entry.message.content));
		}
		if (lines.length > 0) sections.push(lines.join("\n"));
	}
	return sections.join("\n\n");
}

function todayJournalFile(): string {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const dd = String(now.getDate()).padStart(2, "0");
	return `${yyyy}_${mm}_${dd}.md`;
}

function pageFilename(title: string): string {
	// Logseq uses triple-lowbar for /, %3A for :, etc.
	return title.replace(/\//g, "___").replace(/:/g, "%3A").replace(/\?/g, "%3F") + ".md";
}

function completeText(
	model: NonNullable<ReturnType<typeof getModel>>,
	apiKey: string,
	headers: Record<string, string> | undefined,
	prompt: string,
): Promise<string> {
	return complete(
		model,
		{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
		{ apiKey, headers, reasoningEffort: "medium" },
	).then((r) =>
		r.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n"),
	);
}

interface WriteupMeta {
	title: string;
	tags: string[];
	journalSummary: string;
}

function extractJson(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	const candidate = (fenced ? fenced[1]! : trimmed).trim();
	if (!candidate) return null;

	try {
		return JSON.parse(candidate);
	} catch {
		const start = candidate.indexOf("{");
		const end = candidate.lastIndexOf("}");
		if (start === -1 || end === -1 || end <= start) return null;
		try {
			return JSON.parse(candidate.slice(start, end + 1));
		} catch {
			return null;
		}
	}
}

function cleanSingleLine(text: string, fallback: string, maxLength = 120): string {
	const cleaned = text
		.replace(/[\r\n\t]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/[\[\]`#]/g, "")
		.trim();
	return (cleaned || fallback).slice(0, maxLength).trim();
}

function fallbackTitle(conversationText: string): string {
	const firstUserLine = conversationText
		.split("\n")
		.find((line) => line.trim().startsWith("User:"))
		?.replace(/^\s*User:\s*/, "");
	const seed = firstUserLine || conversationText.split("\n")[0] || "Session Writeup";
	const words = cleanSingleLine(seed, "Session Writeup")
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 5)
		.join(" ");
	return words || "Session Writeup";
}

function fallbackMetadata(conversationText: string): WriteupMeta {
	const title = fallbackTitle(conversationText);
	return {
		title,
		tags: ["pi-agent"],
		journalSummary: `Captured session notes for ${title}`,
	};
}

function parseMetadata(text: string, conversationText: string): WriteupMeta {
	const fallback = fallbackMetadata(conversationText);
	const parsed = extractJson(text);
	if (!parsed) return fallback;

	const tags = Array.isArray(parsed.tags)
		? parsed.tags
			.filter((tag): tag is string => typeof tag === "string")
			.map((tag) => tag.toLowerCase().replace(/[^a-z0-9-]/g, "").trim())
			.filter(Boolean)
			.slice(0, 8)
		: fallback.tags;

	return {
		title: cleanSingleLine(typeof parsed.title === "string" ? parsed.title : fallback.title, fallback.title, 80),
		tags: tags.length > 0 ? tags : fallback.tags,
		journalSummary: cleanSingleLine(
			typeof parsed.journalSummary === "string" ? parsed.journalSummary : fallback.journalSummary,
			fallback.journalSummary,
			160,
		),
	};
}

function fallbackBody(conversationText: string): string {
	const excerpt = conversationText
		.split("\n")
		.map((line) => cleanSingleLine(line, ""))
		.filter(Boolean)
		.slice(0, 20);
	return [
		"- **Summary**: The Logseq writeup model did not return body text, so this page captured a short conversation excerpt instead.",
		"- **Conversation excerpt**:",
		...excerpt.map((line) => `\t- ${line}`),
	].join("\n");
}

async function generateWriteup(
	conversationText: string,
	apiKey: string,
	headers: Record<string, string> | undefined,
	model: ReturnType<typeof getModel>,
	customPrompt?: string,
): Promise<{ title: string; tags: string[]; body: string; journalSummary: string }> {
	const customGuidance = customPrompt
		? `\n\nIMPORTANT — the user provided these specific instructions for this writeup:\n<user-instructions>\n${customPrompt}\n</user-instructions>\nFollow these instructions closely. They override the default structure and focus.`
		: "";

	// Step 1: Get metadata (small JSON — no multi-line strings)
	const metaPrompt = `You are a technical writer. Given the conversation below, return ONLY a JSON object with:
- "title": A short page title — 2-5 words max, like a project name not a sentence (e.g. "Coffee Switch OTA Failure", "Pool Pump Schedule", "Ecovacs WiFi Issue")
- "tags": An array of relevant lowercase tags (e.g. ["home-assistant", "debugging"])
- "journalSummary": A single concise line summarizing what was done (do NOT include any page link)${customGuidance}

<conversation>
${conversationText}
</conversation>`;

	const metaText = await completeText(model!, apiKey, headers, metaPrompt);
	const meta = parseMetadata(metaText, conversationText);

	// Step 2: Get body (freeform markdown — no JSON escaping issues)
	const bodyPrompt = `You are a technical writer. Given the conversation below, write a Logseq page that matches the author's natural writing style.

Output ONLY the Logseq-flavoured markdown body — no frontmatter, no code fences around the whole thing.

Writing style rules:
- DO NOT use markdown headings (# ## ###). Instead use **bold text** for section labels.
- Keep the structure relatively flat. Prefer 1-2 levels of nesting, not deep hierarchies.
- Write in complete, descriptive sentences rather than terse labels or sentence fragments.
- Use **bold** inline for emphasis and key terms.
- Every content line must start with "- " (top-level) or tab + "- " (nested).
- Code blocks and tables go inside bullet blocks.
- Be concise but informative. Summarise what was done, what was found, and what changed.
- Group related information naturally rather than forcing rigid sections like "Investigation", "Findings", "Resolution".
- Use Australian English spelling (e.g. organisation, colour, analyse, optimise, behaviour, defence, centre, licence).
- Do NOT use em dashes or en dashes. Use commas, full stops, colons, or parentheses instead.
- Use a natural, direct tone. Not overly formal or corporate.

Example of CORRECT style:
- **Background**: The server CT was threaded through Tesla Phase C (ch13), causing cross-phase measurement errors and requiring a min() hack to estimate server power.
- **What changed**:
	- Installed dedicated SCT-013-030 CT on channel 6 for the server circuit
	- Simplified Tesla formula from a min() approximation to a clean 3-phase sum
	- Added Kitchen and Laundry as separate per-phase residual outputs
- **Configuration**: Generic CT with 1860 turns, phase lead 3, burden adjusted to 15.12Ω (parallel of internal 62Ω and IoTaWatt 20Ω)

Example of WRONG style (do not do this):
- # Server CT Migration
	- ## Summary
		- Migrated server monitoring to dedicated CT
	- ## Investigation
		- ### Current Setup
			- Server wire threaded through Tesla_C${customGuidance}

<conversation>
${conversationText}
</conversation>`;

	const bodyText = (await completeText(model!, apiKey, headers, bodyPrompt)).trim();

	return {
		title: meta.title,
		tags: meta.tags,
		body: bodyText || fallbackBody(conversationText),
		journalSummary: meta.journalSummary,
	};
}

const LOGSEQ_CUSTOM_TYPE = "logseq-writeup";

interface LogseqState {
	title: string;
	journalFile: string;
}

export default function (pi: ExtensionAPI) {
	// Restore state from session on load
	let logseqState: LogseqState | null = null;

	function restoreState(ctx: { sessionManager: { getBranch(): SessionEntry[] } }) {
		logseqState = null;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (
				entry.type === "custom" &&
				"customType" in entry &&
				(entry as any).customType === LOGSEQ_CUSTOM_TYPE &&
				"data" in entry
			) {
				logseqState = (entry as any).data as LogseqState;
			}
		}
	}

	// Reset state on initial load
	pi.on("session_start", async (_event, ctx) => restoreState(ctx));

	// Reset state when switching sessions (/new, /resume)
	pi.on("session_switch", async (_event, ctx) => restoreState(ctx));

	// Reset state when forking (/fork)
	pi.on("session_fork", async (_event, ctx) => restoreState(ctx));

	pi.registerCommand("logseq", {
		description: "Write up the current session to Logseq with a journal entry. Optional: add a prompt to guide the writeup (e.g. /logseq focus on the root cause and fix only)",
		handler: async (args, ctx: ExtensionCommandContext) => {
			const customPrompt = args.trim() || undefined;

			// 1. Extract conversation
			const branch = ctx.sessionManager.getBranch();
			const conversationText = buildConversationText(branch);

			if (!conversationText.trim()) {
				ctx.ui.notify("No conversation content found", "warning");
				return;
			}

			// 2. Get model & API key
			const model = getModel(LOGSEQ_MODEL_PROVIDER, LOGSEQ_MODEL_ID);
			if (!model) {
				ctx.ui.notify(`Model ${LOGSEQ_MODEL_LABEL} not found`, "error");
				return;
			}
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
			if (!auth.ok) {
				ctx.ui.notify(auth.error, "error");
				return;
			}
			if (!auth.apiKey) {
				ctx.ui.notify(`No API key for ${LOGSEQ_MODEL_LABEL}`, "error");
				return;
			}

			// 3. Generate writeup
			const isUpdate = logseqState !== null;
			const promptNote = customPrompt ? ` (with custom instructions)` : "";
			ctx.ui.notify(isUpdate ? `Updating writeup${promptNote}...` : `Generating writeup${promptNote}...`, "info");

			let writeup: Awaited<ReturnType<typeof generateWriteup>>;
			try {
				writeup = await generateWriteup(conversationText, auth.apiKey, auth.headers, model, customPrompt);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				ctx.ui.notify(`Failed to generate writeup: ${msg}`, "error");
				return;
			}

			// 4. Use existing title on update, new title on first run
			//    All pi-agent pages live under the "Pi Agent/" namespace
			const PI_AGENT_NS = "Pi Agent/";
			const rawTitle = logseqState?.title ?? writeup.title;
			const title = rawTitle.startsWith(PI_AGENT_NS) ? rawTitle : PI_AGENT_NS + rawTitle;

			// 5. Build page content
			const tagsLine = writeup.tags.join(", ");
			const now = new Date();
			const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
			const sessionFile = ctx.sessionManager.getSessionFile();
			const sessionLine = sessionFile ? `\nsession:: \`pi --session ${sessionFile}\`` : "";
			const pageContent = `tags:: ${tagsLine}\ndate:: ${dateStr}${sessionLine}\n\n${writeup.body}\n`;

			// 6. Write page file (overwrite on update)
			const pageFile = path.join(PAGES_DIR, pageFilename(title));
			fs.mkdirSync(PAGES_DIR, { recursive: true });
			fs.writeFileSync(pageFile, pageContent, "utf-8");

			// 7. Write or update journal entry
			const journalFile = logseqState?.journalFile ?? path.join(JOURNALS_DIR, todayJournalFile());
			fs.mkdirSync(JOURNALS_DIR, { recursive: true });

			const journalLine = `- ${writeup.journalSummary} [[${title}]]`;
			const pageLink = `[[${title}]]`;

			if (fs.existsSync(journalFile)) {
				const existing = fs.readFileSync(journalFile, "utf-8");
				const lines = existing.split("\n");
				const idx = lines.findIndex((l) => l.includes(pageLink));
				if (idx !== -1) {
					// Replace existing journal line for this page
					lines[idx] = journalLine;
					fs.writeFileSync(journalFile, lines.join("\n"), "utf-8");
				} else {
					// Append new entry
					fs.writeFileSync(journalFile, existing.trimEnd() + "\n" + journalLine + "\n", "utf-8");
				}
			} else {
				fs.writeFileSync(journalFile, journalLine + "\n", "utf-8");
			}

			// 8. Persist state in session for future updates
			logseqState = { title, journalFile };
			pi.appendEntry(LOGSEQ_CUSTOM_TYPE, logseqState);

			// 9. Name the session for easy /resume discovery
			pi.setSessionName(title);

			ctx.ui.notify(
				isUpdate
					? `✅ Updated page "${title}" and journal entry`
					: `✅ Created page "${title}" and added journal entry`,
				"success",
			);
		},
	});
}
