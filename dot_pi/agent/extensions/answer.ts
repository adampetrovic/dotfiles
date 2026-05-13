/**
 * Q&A extraction hook - extracts questions from assistant responses
 *
 * Custom interactive TUI for answering questions.
 *
 * Demonstrates the "prompt generator" pattern with custom TUI:
 * 1. /answer command gets the last assistant message
 * 2. Shows a spinner while extracting questions as structured JSON
 * 3. Presents an interactive TUI to navigate and answer questions
 * 4. Submits the compiled answers when done
 */

import { complete, Type, type Api, type Model, type ToolCall, type UserMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	truncateToWidth,
	type TUI,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

// Structured output format for question extraction
interface ExtractedQuestion {
	question: string;
	context?: string;
}

interface ExtractionResult {
	questions: ExtractedQuestion[];
}

const SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need user input.

When the extract_questions tool is available, call it exactly once with this shape:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

If tools are not available, output only the same JSON object. Do not wrap it in markdown. Do not add commentary.

Rules:
- Extract all questions that require user input
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- If no questions are found, return or call the tool with {"questions": []}
- Do not answer the questions yourself

Example payload:
{
  "questions": [
    {
      "question": "What is your preferred database?",
      "context": "We can only configure MySQL and PostgreSQL because of what is implemented."
    },
    {
      "question": "Should we use TypeScript or JavaScript?"
    }
  ]
}`;

const EXTRACT_QUESTIONS_TOOL_NAME = "extract_questions";

const EXTRACT_QUESTIONS_TOOL = {
	name: EXTRACT_QUESTIONS_TOOL_NAME,
	description: "Return every question in the supplied conversation text that needs user input.",
	parameters: Type.Object({
		questions: Type.Array(
			Type.Object({
				question: Type.String({ description: "The concise question text." }),
				context: Type.Optional(
					Type.String({ description: "Essential context needed to answer the question, if any." }),
				),
			}),
			{ description: "Questions in the order they appeared." },
		),
	}),
};

const CODEX_MODEL_ID = "gpt-5.1-codex-mini";
const HAIKU_MODEL_ID = "claude-haiku-4-5";

type ModelRegistry = ExtensionContext["modelRegistry"];

async function hasUsableApiKey(modelRegistry: ModelRegistry, model: Model<Api>): Promise<boolean> {
	const auth = await modelRegistry.getApiKeyAndHeaders(model);
	return auth.ok && !!auth.apiKey;
}

/**
 * Prefer Codex mini for extraction when available, otherwise fallback to haiku or the current model.
 */
async function selectExtractionModel(currentModel: Model<Api>, modelRegistry: ModelRegistry): Promise<Model<Api>> {
	const codexModel = modelRegistry.find("openai-codex", CODEX_MODEL_ID);
	if (codexModel && (await hasUsableApiKey(modelRegistry, codexModel))) {
		return codexModel;
	}

	const haikuModel = modelRegistry.find("anthropic", HAIKU_MODEL_ID);
	if (haikuModel && (await hasUsableApiKey(modelRegistry, haikuModel))) {
		return haikuModel;
	}

	return currentModel;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeExtractionResult(value: unknown): ExtractionResult | null {
	const root = Array.isArray(value) ? { questions: value } : value;
	if (!isRecord(root) || !Array.isArray(root.questions)) {
		return null;
	}

	const questions: ExtractedQuestion[] = [];
	for (const item of root.questions) {
		if (typeof item === "string") {
			const question = item.trim();
			if (question.length > 0) questions.push({ question });
			continue;
		}

		if (!isRecord(item) || typeof item.question !== "string") {
			return null;
		}

		const question = item.question.trim();
		if (question.length === 0) continue;

		const context = typeof item.context === "string" ? item.context.trim() : undefined;
		questions.push(context ? { question, context } : { question });
	}

	return { questions };
}

function parseJsonCandidate(candidate: string): ExtractionResult | null {
	const trimmed = candidate.trim().replace(/^\uFEFF/, "");
	if (!trimmed) return null;

	const jsonTagMatch = trimmed.match(/^<json>\s*([\s\S]*?)\s*<\/json>$/i);
	const unwrapped = jsonTagMatch ? jsonTagMatch[1].trim() : trimmed;
	const withoutTrailingCommas = unwrapped.replace(/,\s*([}\]])/g, "$1");
	const variants = unwrapped === withoutTrailingCommas ? [unwrapped] : [unwrapped, withoutTrailingCommas];

	for (const variant of variants) {
		try {
			const normalized = normalizeExtractionResult(JSON.parse(variant));
			if (normalized) return normalized;
		} catch {
			// Try the next candidate.
		}
	}

	return null;
}

function findBalancedJsonCandidates(text: string): string[] {
	const candidates: string[] = [];
	const closingFor: Record<string, string> = { "{": "}", "[": "]" };

	for (let start = 0; start < text.length; start++) {
		const first = text[start];
		if (first !== "{" && first !== "[") continue;

		const stack: string[] = [];
		let inString = false;
		let escaped = false;

		for (let index = start; index < text.length; index++) {
			const char = text[index];

			if (inString) {
				if (escaped) {
					escaped = false;
				} else if (char === "\\") {
					escaped = true;
				} else if (char === '"') {
					inString = false;
				}
				continue;
			}

			if (char === '"') {
				inString = true;
				continue;
			}

			const expectedClosing = closingFor[char];
			if (expectedClosing) {
				stack.push(expectedClosing);
				continue;
			}

			if (char === "}" || char === "]") {
				if (stack.pop() !== char) break;
				if (stack.length === 0) {
					candidates.push(text.slice(start, index + 1));
					if (candidates.length >= 20) return candidates;
					break;
				}
			}
		}
	}

	return candidates;
}

/**
 * Parse the JSON response from the LLM. Be tolerant of common wrappers so the
 * command doesn't fail just because the extractor included a preface or fence.
 */
function parseExtractionResult(text: string): ExtractionResult | null {
	const candidates: string[] = [text];

	const fenceRegex = /```(?:json|jsonc)?[^\n`]*\n?([\s\S]*?)```/gi;
	for (const match of text.matchAll(fenceRegex)) {
		if (match[1]) candidates.push(match[1]);
	}

	const jsonTagRegex = /<json>\s*([\s\S]*?)\s*<\/json>/gi;
	for (const match of text.matchAll(jsonTagRegex)) {
		if (match[1]) candidates.push(match[1]);
	}

	candidates.push(...findBalancedJsonCandidates(text));

	const seen = new Set<string>();
	for (const candidate of candidates) {
		const key = candidate.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);

		const parsed = parseJsonCandidate(candidate);
		if (parsed) return parsed;
	}

	return null;
}

function isToolCallContent(content: unknown): content is ToolCall {
	return isRecord(content) && content.type === "toolCall" && typeof content.name === "string";
}

function parseExtractionToolCall(content: unknown[]): ExtractionResult | null {
	for (const item of content) {
		if (!isToolCallContent(item) || item.name !== EXTRACT_QUESTIONS_TOOL_NAME) continue;

		const parsed = typeof item.arguments === "string"
			? parseExtractionResult(item.arguments)
			: normalizeExtractionResult(item.arguments);
		if (parsed) return parsed;
	}

	return null;
}

function getTextContent(content: unknown[]): string {
	return content
		.filter((c): c is { type: "text"; text: string } => isRecord(c) && c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n");
}

function getThinkingContent(content: unknown[]): string {
	return content
		.filter((c): c is { type: "thinking"; thinking: string } =>
			isRecord(c) && c.type === "thinking" && typeof c.thinking === "string",
		)
		.map((c) => c.thinking)
		.join("\n");
}

function summarizeInvalidResponse(text: string): string {
	const compact = text.replace(/\s+/g, " ").trim();
	if (!compact) return "empty model response";
	return compact.length > 500 ? `${compact.slice(0, 500)}…` : compact;
}

function summarizeContentTypes(content: unknown[]): string {
	const types = content.map((c) => (isRecord(c) && typeof c.type === "string" ? c.type : typeof c));
	return types.length > 0 ? types.join(",") : "none";
}

function cleanHeuristicQuestion(question: string): string {
	return question
		.replace(/^\s*(?:[-*•]\s*)?(?:\d+[.)]\s*)?(?:Q\s*[:.)-]\s*)?/i, "")
		.replace(/\s+/g, " ")
		.trim();
}

function extractQuestionsHeuristically(text: string): ExtractionResult {
	const questions: ExtractedQuestion[] = [];
	const seen = new Set<string>();
	const addQuestion = (raw: string) => {
		const question = cleanHeuristicQuestion(raw);
		if (!question.endsWith("?") || question.length < 4) return;
		const key = question.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		questions.push({ question });
	};

	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || /^```/.test(trimmed)) continue;
		for (const match of trimmed.matchAll(/[^?]{3,}\?/g)) {
			addQuestion(match[0]);
		}
	}

	return { questions };
}

/**
 * Interactive Q&A component for answering extracted questions
 */
class QnAComponent implements Component {
	private questions: ExtractedQuestion[];
	private answers: string[];
	private currentIndex: number = 0;
	private editor: Editor;
	private tui: TUI;
	private onDone: (result: string | null) => void;
	private showingConfirmation: boolean = false;

	// Cache
	private cachedWidth?: number;
	private cachedLines?: string[];

	// Colors - using proper reset sequences
	private dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
	private bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
	private cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
	private green = (s: string) => `\x1b[32m${s}\x1b[0m`;
	private yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
	private gray = (s: string) => `\x1b[90m${s}\x1b[0m`;

	constructor(
		questions: ExtractedQuestion[],
		tui: TUI,
		onDone: (result: string | null) => void,
	) {
		this.questions = questions;
		this.answers = questions.map(() => "");
		this.tui = tui;
		this.onDone = onDone;

		// Create a minimal theme for the editor
		const editorTheme: EditorTheme = {
			borderColor: this.dim,
			selectList: {
				selectedBg: (s: string) => `\x1b[44m${s}\x1b[0m`,
				matchHighlight: this.cyan,
				itemSecondary: this.gray,
			},
		};

		this.editor = new Editor(tui, editorTheme);
		// Disable the editor's built-in submit (which clears the editor)
		// We'll handle Enter ourselves to preserve the text
		this.editor.disableSubmit = true;
		this.editor.onChange = () => {
			this.invalidate();
			this.tui.requestRender();
		};
	}

	private allQuestionsAnswered(): boolean {
		this.saveCurrentAnswer();
		return this.answers.every((a) => (a?.trim() || "").length > 0);
	}

	private saveCurrentAnswer(): void {
		this.answers[this.currentIndex] = this.editor.getText();
	}

	private navigateTo(index: number): void {
		if (index < 0 || index >= this.questions.length) return;
		this.saveCurrentAnswer();
		this.currentIndex = index;
		this.editor.setText(this.answers[index] || "");
		this.invalidate();
	}

	private submit(): void {
		this.saveCurrentAnswer();

		// Build the response text
		const parts: string[] = [];
		for (let i = 0; i < this.questions.length; i++) {
			const q = this.questions[i];
			const a = this.answers[i]?.trim() || "(no answer)";
			parts.push(`Q: ${q.question}`);
			if (q.context) {
				parts.push(`> ${q.context}`);
			}
			parts.push(`A: ${a}`);
			parts.push("");
		}

		this.onDone(parts.join("\n").trim());
	}

	private cancel(): void {
		this.onDone(null);
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		// Handle confirmation dialog
		if (this.showingConfirmation) {
			if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
				this.submit();
				return;
			}
			if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data.toLowerCase() === "n") {
				this.showingConfirmation = false;
				this.invalidate();
				this.tui.requestRender();
				return;
			}
			return;
		}

		// Global navigation and commands
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
			this.cancel();
			return;
		}

		// Tab / Shift+Tab for navigation
		if (matchesKey(data, Key.tab)) {
			if (this.currentIndex < this.questions.length - 1) {
				this.navigateTo(this.currentIndex + 1);
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(data, Key.shift("tab"))) {
			if (this.currentIndex > 0) {
				this.navigateTo(this.currentIndex - 1);
				this.tui.requestRender();
			}
			return;
		}

		// Arrow up/down for question navigation when editor is empty
		// (Editor handles its own cursor navigation when there's content)
		if (matchesKey(data, Key.up) && this.editor.getText() === "") {
			if (this.currentIndex > 0) {
				this.navigateTo(this.currentIndex - 1);
				this.tui.requestRender();
				return;
			}
		}
		if (matchesKey(data, Key.down) && this.editor.getText() === "") {
			if (this.currentIndex < this.questions.length - 1) {
				this.navigateTo(this.currentIndex + 1);
				this.tui.requestRender();
				return;
			}
		}

		// Handle Enter ourselves (editor's submit is disabled)
		// Plain Enter moves to next question or shows confirmation on last question
		// Shift+Enter adds a newline (handled by editor)
		if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
			this.saveCurrentAnswer();
			if (this.currentIndex < this.questions.length - 1) {
				this.navigateTo(this.currentIndex + 1);
			} else {
				// On last question - show confirmation
				this.showingConfirmation = true;
			}
			this.invalidate();
			this.tui.requestRender();
			return;
		}

		// Pass to editor
		this.editor.handleInput(data);
		this.invalidate();
		this.tui.requestRender();
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines: string[] = [];
		const boxWidth = Math.min(width - 4, 120); // Allow wider box
		const contentWidth = boxWidth - 4; // 2 chars padding on each side

		// Helper to create horizontal lines (dim the whole thing at once)
		const horizontalLine = (count: number) => "─".repeat(count);

		// Helper to create a box line
		const boxLine = (content: string, leftPad: number = 2): string => {
			const paddedContent = " ".repeat(leftPad) + content;
			const contentLen = visibleWidth(paddedContent);
			const rightPad = Math.max(0, boxWidth - contentLen - 2);
			return this.dim("│") + paddedContent + " ".repeat(rightPad) + this.dim("│");
		};

		const emptyBoxLine = (): string => {
			return this.dim("│") + " ".repeat(boxWidth - 2) + this.dim("│");
		};

		const padToWidth = (line: string): string => {
			const len = visibleWidth(line);
			return line + " ".repeat(Math.max(0, width - len));
		};

		// Title
		lines.push(padToWidth(this.dim("╭" + horizontalLine(boxWidth - 2) + "╮")));
		const title = `${this.bold(this.cyan("Questions"))} ${this.dim(`(${this.currentIndex + 1}/${this.questions.length})`)}`;
		lines.push(padToWidth(boxLine(title)));
		lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));

		// Progress indicator
		const progressParts: string[] = [];
		for (let i = 0; i < this.questions.length; i++) {
			const answered = (this.answers[i]?.trim() || "").length > 0;
			const current = i === this.currentIndex;
			if (current) {
				progressParts.push(this.cyan("●"));
			} else if (answered) {
				progressParts.push(this.green("●"));
			} else {
				progressParts.push(this.dim("○"));
			}
		}
		lines.push(padToWidth(boxLine(progressParts.join(" "))));
		lines.push(padToWidth(emptyBoxLine()));

		// Current question
		const q = this.questions[this.currentIndex];
		const questionText = `${this.bold("Q:")} ${q.question}`;
		const wrappedQuestion = wrapTextWithAnsi(questionText, contentWidth);
		for (const line of wrappedQuestion) {
			lines.push(padToWidth(boxLine(line)));
		}

		// Context if present
		if (q.context) {
			lines.push(padToWidth(emptyBoxLine()));
			const contextText = this.gray(`> ${q.context}`);
			const wrappedContext = wrapTextWithAnsi(contextText, contentWidth - 2);
			for (const line of wrappedContext) {
				lines.push(padToWidth(boxLine(line)));
			}
		}

		lines.push(padToWidth(emptyBoxLine()));

		// Render the editor component (multi-line input) with padding
		// Skip the first and last lines (editor's own border lines)
		const answerPrefix = this.bold("A: ");
		const editorWidth = contentWidth - 4 - 3; // Extra padding + space for "A: "
		const editorLines = this.editor.render(editorWidth);
		for (let i = 1; i < editorLines.length - 1; i++) {
			if (i === 1) {
				// First content line gets the "A: " prefix
				lines.push(padToWidth(boxLine(answerPrefix + editorLines[i])));
			} else {
				// Subsequent lines get padding to align with the first line
				lines.push(padToWidth(boxLine("   " + editorLines[i])));
			}
		}

		lines.push(padToWidth(emptyBoxLine()));

		// Confirmation dialog or footer with controls
		if (this.showingConfirmation) {
			lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));
			const confirmMsg = `${this.yellow("Submit all answers?")} ${this.dim("(Enter/y to confirm, Esc/n to cancel)")}`;
			lines.push(padToWidth(boxLine(truncateToWidth(confirmMsg, contentWidth))));
		} else {
			lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));
			const controls = `${this.dim("Tab/Enter")} next · ${this.dim("Shift+Tab")} prev · ${this.dim("Shift+Enter")} newline · ${this.dim("Esc")} cancel`;
			lines.push(padToWidth(boxLine(truncateToWidth(controls, contentWidth))));
		}
		lines.push(padToWidth(this.dim("╰" + horizontalLine(boxWidth - 2) + "╯")));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}

export default function (pi: ExtensionAPI) {
	const answerHandler = async (ctx: ExtensionContext) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("answer requires interactive mode", "error");
				return;
			}

			if (!ctx.model) {
				ctx.ui.notify("No model selected", "error");
				return;
			}

			// Find the last assistant message on the current branch
			const branch = ctx.sessionManager.getBranch();
			let lastAssistantText: string | undefined;

			for (let i = branch.length - 1; i >= 0; i--) {
				const entry = branch[i];
				if (entry.type === "message") {
					const msg = entry.message;
					if ("role" in msg && msg.role === "assistant") {
						if (msg.stopReason !== "stop") {
							ctx.ui.notify(`Last assistant message incomplete (${msg.stopReason})`, "error");
							return;
						}
						const textParts = msg.content
							.filter((c): c is { type: "text"; text: string } => c.type === "text")
							.map((c) => c.text);
						if (textParts.length > 0) {
							lastAssistantText = textParts.join("\n");
							break;
						}
					}
				}
			}

			if (!lastAssistantText) {
				ctx.ui.notify("No assistant messages found", "error");
				return;
			}

			// Select the best model for extraction (prefer Codex mini, then haiku)
			const extractionModel = await selectExtractionModel(ctx.model, ctx.modelRegistry);

			// Run extraction with loader UI
			let extractionError: string | undefined;
			const extractionResult = await ctx.ui.custom<ExtractionResult | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, `Extracting questions using ${extractionModel.id}...`);
				loader.onAbort = () => done(null);

				const doExtract = async () => {
					const auth = await ctx.modelRegistry.getApiKeyAndHeaders(extractionModel);
					if (!auth.ok || !auth.apiKey) {
						throw new Error(auth.ok ? `No API key for ${extractionModel.provider}` : auth.error);
					}

					const userMessage: UserMessage = {
						role: "user",
						content: [{ type: "text", text: lastAssistantText! }],
						timestamp: Date.now(),
					};

					const attempts = [
						{ label: "tool", tools: [EXTRACT_QUESTIONS_TOOL] },
						{ label: "json" },
					];
					let lastFailure = "no extraction attempts completed";

					for (const attempt of attempts) {
						const response = await complete(
							extractionModel,
							attempt.tools
								? { systemPrompt: SYSTEM_PROMPT, messages: [userMessage], tools: attempt.tools }
								: { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
							// Force SSE for Codex/Responses models here. The websocket path can complete
							// with only reasoning blocks for function-call style extraction.
							{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal, transport: "sse" },
						);

						if (response.stopReason === "aborted") {
							return null;
						}

						const toolParsed = parseExtractionToolCall(response.content);
						if (toolParsed) return toolParsed;

						const responseText = getTextContent(response.content);
						const parsed = parseExtractionResult(responseText);
						if (parsed) return parsed;

						const diagnosticText = responseText || getThinkingContent(response.content);
						lastFailure = `${attempt.label} attempt stopReason=${response.stopReason}; content=${summarizeContentTypes(
							response.content,
						)}; ${summarizeInvalidResponse(diagnosticText)}`;
					}

					const heuristic = extractQuestionsHeuristically(lastAssistantText!);
					if (heuristic.questions.length > 0) {
						return heuristic;
					}

					throw new Error(
						`Question extractor returned neither an ${EXTRACT_QUESTIONS_TOOL_NAME} tool call nor valid JSON (${lastFailure})`,
					);
				};

				doExtract()
					.then(done)
					.catch((err) => {
						extractionError = err instanceof Error ? err.message : String(err);
						done(null);
					});

				return loader;
			});

			if (extractionResult === null) {
				if (extractionError) {
					ctx.ui.notify(`Question extraction failed: ${extractionError}`, "error");
				} else {
					ctx.ui.notify("Cancelled", "info");
				}
				return;
			}

			if (extractionResult.questions.length === 0) {
				ctx.ui.notify("No questions found in the last message", "info");
				return;
			}

			// Show the Q&A component
			const answersResult = await ctx.ui.custom<string | null>((tui, _theme, _kb, done) => {
				return new QnAComponent(extractionResult.questions, tui, done);
			});

			if (answersResult === null) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			// Send the answers directly as a message and trigger a turn
			pi.sendMessage(
				{
					customType: "answers",
					content: "I answered your questions in the following way:\n\n" + answersResult,
					display: true,
				},
				{ triggerTurn: true },
			);
	};

	pi.registerCommand("answer", {
		description: "Extract questions from last assistant message into interactive Q&A",
		handler: (_args, ctx) => answerHandler(ctx),
	});

	pi.registerShortcut("ctrl+.", {
		description: "Extract and answer questions",
		handler: answerHandler,
	});
}
