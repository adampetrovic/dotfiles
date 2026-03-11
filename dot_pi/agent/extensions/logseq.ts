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
	prompt: string,
): Promise<string> {
	return complete(
		model,
		{ messages: [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }] },
		{ apiKey, reasoningEffort: "high" },
	).then((r) =>
		r.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n"),
	);
}

function extractJson(text: string): Record<string, unknown> {
	const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	return JSON.parse((fenced ? fenced[1]! : text).trim());
}

async function generateWriteup(
	conversationText: string,
	apiKey: string,
	model: ReturnType<typeof getModel>,
): Promise<{ title: string; tags: string[]; body: string; journalSummary: string }> {
	// Step 1: Get metadata (small JSON — no multi-line strings)
	const metaPrompt = `You are a technical writer. Given the conversation below, return ONLY a JSON object with:
- "title": A concise descriptive page title (no special characters besides hyphens and spaces)
- "tags": An array of relevant lowercase tags (e.g. ["home-assistant", "debugging"])
- "journalSummary": A single concise line summarizing what was done (do NOT include any page link)

<conversation>
${conversationText}
</conversation>`;

	const metaText = await completeText(model!, apiKey, metaPrompt);
	const meta = extractJson(metaText);

	// Step 2: Get body (freeform markdown — no JSON escaping issues)
	const bodyPrompt = `You are a technical writer. Given the conversation below, write a structured Logseq page.

Output ONLY the Logseq-flavoured markdown body — no frontmatter, no code fences around the whole thing.

Logseq formatting rules:
- Every content line must start with "- " (top-level) or tab + "- " (nested)
- Section headings use "- # Heading" or "- ## Heading"
- Nested content under a heading uses one additional tab level
- Code blocks and tables go inside bullet blocks
- Include sections like Summary, Investigation, Findings, Root Cause, Resolution as appropriate

<conversation>
${conversationText}
</conversation>`;

	const body = await completeText(model!, apiKey, bodyPrompt);

	return {
		title: meta.title as string,
		tags: (meta.tags as string[]) || [],
		body: body.trim(),
		journalSummary: meta.journalSummary as string,
	};
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("logseq", {
		description: "Write up the current session to Logseq with a journal entry",
		handler: async (args, ctx: ExtensionCommandContext) => {
			// 1. Extract conversation
			const branch = ctx.sessionManager.getBranch();
			const conversationText = buildConversationText(branch);

			if (!conversationText.trim()) {
				ctx.ui.notify("No conversation content found", "warning");
				return;
			}

			// 2. Get model & API key
			const model = getModel("anthropic", "claude-sonnet-4-20250514");
			if (!model) {
				ctx.ui.notify("Model anthropic/claude-sonnet-4 not found", "error");
				return;
			}
			const apiKey = await ctx.modelRegistry.getApiKey(model);
			if (!apiKey) {
				ctx.ui.notify("No API key for anthropic/claude-sonnet-4", "error");
				return;
			}

			// 3. Generate writeup
			ctx.ui.notify("Generating writeup...", "info");

			let writeup: Awaited<ReturnType<typeof generateWriteup>>;
			try {
				writeup = await generateWriteup(conversationText, apiKey, model);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				ctx.ui.notify(`Failed to generate writeup: ${msg}`, "error");
				return;
			}

			const title = writeup.title;

			// 5. Build page content
			const tagsLine = writeup.tags.join(", ");
			const now = new Date();
			const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
			const sessionFile = ctx.sessionManager.getSessionFile();
			const sessionLine = sessionFile ? `\nsession:: \`pi --session ${sessionFile}\`` : "";
			const pageContent = `tags:: ${tagsLine}\ndate:: ${dateStr}${sessionLine}\n\n${writeup.body}\n`;

			// 6. Write page file
			const pageFile = path.join(PAGES_DIR, pageFilename(title));
			if (fs.existsSync(pageFile)) {
				const overwrite = await ctx.ui.confirm("Page exists", `${title} already exists. Overwrite?`);
				if (!overwrite) {
					ctx.ui.notify("Cancelled", "info");
					return;
				}
			}
			fs.mkdirSync(PAGES_DIR, { recursive: true });
			fs.writeFileSync(pageFile, pageContent, "utf-8");

			// 7. Append journal entry
			const journalFile = path.join(JOURNALS_DIR, todayJournalFile());
			fs.mkdirSync(JOURNALS_DIR, { recursive: true });

			const journalLine = `- ${writeup.journalSummary} [[${title}]]`;
			if (fs.existsSync(journalFile)) {
				const existing = fs.readFileSync(journalFile, "utf-8");
				fs.writeFileSync(journalFile, existing.trimEnd() + "\n" + journalLine + "\n", "utf-8");
			} else {
				fs.writeFileSync(journalFile, journalLine + "\n", "utf-8");
			}

			// 8. Name the session for easy /resume discovery
			pi.setSessionName(title);

			ctx.ui.notify(`✅ Created page "${title}" and added journal entry`, "success");
		},
	});
}
