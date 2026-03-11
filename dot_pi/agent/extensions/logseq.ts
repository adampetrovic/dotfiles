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

async function generateWriteup(
	conversationText: string,
	apiKey: string,
	model: ReturnType<typeof getModel>,
): Promise<{ title: string; tags: string[]; body: string; journalSummary: string }> {
	const prompt = `You are a technical writer. Given the following conversation between a user and an AI assistant, produce a structured Logseq writeup.

Return ONLY a JSON object with these fields:
- "title": A concise, descriptive page title (no special characters besides hyphens and spaces)
- "tags": An array of relevant lowercase tags (e.g. ["home-assistant", "debugging", "shelly"])
- "body": The full writeup in Logseq-flavored markdown using bullet blocks (every line starts with "- " or a tab-indented "- " for nesting). Include sections like Summary, Investigation, Findings, Root Cause, Resolution as appropriate. Use code blocks, tables, and structured content where helpful.
- "journalSummary": A single concise line summarizing what was done, suitable for a daily journal entry (do NOT include the page link — that will be added automatically)

Important Logseq formatting rules:
- Every content line must start with "- " (top-level) or tab + "- " (nested)
- Section headings use "- # Heading" or "- ## Heading"
- Nested content under a heading uses one additional tab level
- Code blocks and tables go inside bullet blocks

<conversation>
${conversationText}
</conversation>`;

	const response = await complete(
		model!,
		{
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: prompt }],
					timestamp: Date.now(),
				},
			],
		},
		{ apiKey, reasoningEffort: "high" },
	);

	const text = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");

	// Extract JSON from the response (handle markdown code fences)
	const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, text];
	const parsed = JSON.parse(jsonMatch[1]!.trim());

	return {
		title: parsed.title,
		tags: parsed.tags || [],
		body: parsed.body,
		journalSummary: parsed.journalSummary,
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

			// 4. Let user confirm/edit title
			const title = await ctx.ui.input("Page Title", writeup.title);
			if (!title) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

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
