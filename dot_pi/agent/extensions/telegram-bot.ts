/**
 * Telegram Bot Remote Control Extension for Pi
 *
 * Connect your running Pi session to a Telegram Bot, so you can send messages
 * from Telegram and receive Pi's responses — like a remote control for your terminal.
 *
 * Features:
 *   - Live activity feed while working (shows current tool/action)
 *   - Clean final message replaces activity feed when done
 *   - Bidirectional: both terminal and Telegram can control Pi
 *   - /steer and /followup prefixes to control behavior while agent is busy
 *   - Long message auto-splitting with rate-limit-aware retry
 *   - Image support (photos and image documents forwarded to Claude)
 *   - Voice note transcription via whisper.cpp (Apple Silicon optimized)
 *   - Graceful connect/disconnect
 *
 * Setup:
 *   1. Create a bot via @BotFather on Telegram, get the token
 *   2. Set environment variable: export TELEGRAM_BOT_TOKEN=your-token-here
 *   3. (Optional) Set TELEGRAM_CHAT_ID to restrict access to a specific chat
 *
 * Usage:
 *   /telegram-bot          - Connect (toggle on/off)
 *   /telegram-bot <token>  - Connect with a specific token
 *   /telegram-bot stop     - Disconnect
 *   /telegram-bot status   - Show connection status
 *
 * While agent is busy:
 *   /steer <message>       - Interrupt the agent and redirect
 *   /followup <message>    - Queue message for after the agent finishes (default)
 *   /abort                 - Stop the current agent operation
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";

const TELEGRAM_API = "https://api.telegram.org/bot";

export default function (pi: ExtensionAPI) {
	// ── State ──────────────────────────────────────────────────────────
	let token: string | null = null;
	let isConnected = false;
	let pollAbort: AbortController | null = null;
	let botUsername = "";
	let agentBusy = false;
	let allowedChatId: number | null = null;
	let activeChatIds = new Set<number>();
	let messageCount = { sent: 0, received: 0 };
	let latestCtx: any = null;

	// ── Rate Limit State ──────────────────────────────────────────────
	let rateLimitedUntil = 0;                        // timestamp when rate limit expires (0 = not limited)
	let rateLimitTimer: ReturnType<typeof setTimeout> | null = null;

	// ── Activity Feed State ───────────────────────────────────────────
	// Single message per chat that gets edited with current activity,
	// then deleted and replaced with the final response.
	let activityMsgIds = new Map<number, number>(); // chatId → message_id
	let activityLines: string[] = [];               // accumulated activity lines
	let lastEditTime = 0;                           // rate limit edits
	let pendingEdit = false;                        // coalesce rapid updates
	let editTimer: ReturnType<typeof setTimeout> | null = null;
	const MIN_EDIT_INTERVAL_MS = 4000;              // min 4s between edits (Telegram limits ~20 edits/min/chat)

	// ── Telegram API ──────────────────────────────────────────────────

	function tgApi(method: string, params: Record<string, any> = {}, signal?: AbortSignal): Promise<any> {
		return new Promise((resolve, reject) => {
			const body = JSON.stringify(params);
			const url = new URL(`${TELEGRAM_API}${token}/${method}`);
			const req = https.request(
				{
					hostname: url.hostname,
					path: url.pathname,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Content-Length": Buffer.byteLength(body),
					},
					family: 4,
				},
				(res) => {
					let data = "";
					res.on("data", (chunk) => (data += chunk));
					res.on("end", () => {
						try {
							const parsed = JSON.parse(data);
							if (!parsed.ok) {
								// Detect rate limiting and track expiry
								if (parsed.error_code === 429 && parsed.parameters?.retry_after) {
									const retryAfter = parsed.parameters.retry_after;
									setRateLimited(retryAfter);
								}
								reject(new Error(parsed.description || `Telegram API ${method} failed`));
							} else {
								// Successful call — clear rate limit if it was set
								if (rateLimitedUntil > 0 && Date.now() >= rateLimitedUntil) {
									clearRateLimit();
								}
								resolve(parsed.result);
							}
						} catch (e) {
							reject(e);
						}
					});
				},
			);
			req.on("error", reject);
			if (signal) {
				signal.addEventListener("abort", () => req.destroy());
			}
			req.write(body);
			req.end();
		});
	}

	let rateLimitTickTimer: ReturnType<typeof setInterval> | null = null;

	function setRateLimited(retryAfterSecs: number): void {
		rateLimitedUntil = Date.now() + retryAfterSecs * 1000;

		// Clear any existing timers
		if (rateLimitTimer) clearTimeout(rateLimitTimer);
		if (rateLimitTickTimer) clearInterval(rateLimitTickTimer);

		// Refresh countdown in status bar every 15s
		rateLimitTickTimer = setInterval(() => {
			if (latestCtx) updateStatus(latestCtx);
		}, 15000);

		// Auto-clear when the limit expires
		rateLimitTimer = setTimeout(() => {
			clearRateLimit();
		}, retryAfterSecs * 1000);

		// Update status immediately
		if (latestCtx) updateStatus(latestCtx);
	}

	function clearRateLimit(): void {
		rateLimitedUntil = 0;
		if (rateLimitTimer) {
			clearTimeout(rateLimitTimer);
			rateLimitTimer = null;
		}
		if (rateLimitTickTimer) {
			clearInterval(rateLimitTickTimer);
			rateLimitTickTimer = null;
		}
		if (latestCtx) updateStatus(latestCtx);
	}

	// ── Voice Transcription ───────────────────────────────────────────

	const WHISPER_MODEL = path.join(os.homedir(), ".local/share/whisper-cpp/models/ggml-large-v3-turbo.bin");

	function downloadFile(url: string, destPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const file = fs.createWriteStream(destPath);
			https.get(url, { family: 4 }, (res) => {
				if (res.statusCode === 301 || res.statusCode === 302) {
					file.close();
					fs.unlinkSync(destPath);
					downloadFile(res.headers.location!, destPath).then(resolve, reject);
					return;
				}
				res.pipe(file);
				file.on("finish", () => { file.close(); resolve(); });
			}).on("error", (e) => {
				file.close();
				fs.unlinkSync(destPath);
				reject(e);
			});
		});
	}

	function runCommand(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) reject(error);
				else resolve({ stdout, stderr });
			});
		});
	}

	async function transcribeVoice(fileId: string): Promise<string> {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-voice-"));

		try {
			const fileInfo = await tgApi("getFile", { file_id: fileId });
			const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

			const oggPath = path.join(tmpDir, "voice.ogg");
			await downloadFile(fileUrl, oggPath);

			const wavPath = path.join(tmpDir, "voice.wav");
			await runCommand("ffmpeg", ["-i", oggPath, "-ar", "16000", "-ac", "1", "-y", wavPath]);

			const { stdout } = await runCommand("whisper-cli", [
				"-m", WHISPER_MODEL,
				"-f", wavPath,
				"--no-timestamps",
				"-l", "en",
				"--no-prints",
			]);

			const text = stdout.trim();
			if (!text) throw new Error("Whisper returned empty transcription");
			return text;
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	}

	// ── Message Sending ───────────────────────────────────────────────

	async function sendMessage(chatId: number, text: string, parseMode?: string): Promise<any> {
		const params: Record<string, any> = { chat_id: chatId, text };
		if (parseMode) params.parse_mode = parseMode;

		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				return await tgApi("sendMessage", params);
			} catch (e: any) {
				const isRateLimit = e?.message?.includes("429") || e?.message?.toLowerCase()?.includes("too many");
				if (isRateLimit && attempt < 2) {
					await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
					continue;
				}
				throw e;
			}
		}
	}

	async function sendFinalMessage(chatId: number, text: string): Promise<void> {
		if (!text.trim()) return;

		const chunks = splitMessage(text, 4000);
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			if (i > 0) await new Promise((r) => setTimeout(r, 1000));

			try {
				await sendMessage(chatId, chunk, "Markdown");
			} catch {
				try {
					await sendMessage(chatId, chunk);
				} catch (e2: any) {
					console.error(`[telegram-bot] Failed to send message to chat ${chatId}: ${e2?.message || e2}`);
				}
			}
		}
	}

	async function sendToAllChats(text: string): Promise<void> {
		for (const chatId of activeChatIds) {
			await sendFinalMessage(chatId, text).catch(() => {});
		}
		if (text.trim()) messageCount.sent++;
	}

	function splitMessage(text: string, maxLen: number): string[] {
		if (text.length <= maxLen) return [text];
		const chunks: string[] = [];
		let remaining = text;
		while (remaining.length > 0) {
			if (remaining.length <= maxLen) {
				chunks.push(remaining);
				break;
			}
			let splitAt = remaining.lastIndexOf("\n", maxLen);
			if (splitAt < maxLen * 0.3) splitAt = maxLen;
			chunks.push(remaining.slice(0, splitAt));
			remaining = remaining.slice(splitAt).replace(/^\n/, "");
		}
		return chunks;
	}

	// ── Activity Feed ─────────────────────────────────────────────────
	// Shows a live-updating message with what the agent is currently doing.
	// Edits are rate-limited to avoid Telegram 429s.

	function formatToolAction(toolName: string, args: any): string {
		switch (toolName) {
			case "Read":
			case "read":
				return `📖 Reading ${friendlyPath(args?.path)}`;
			case "Bash":
			case "bash":
				return `⚙️ ${describeBashCommand(args?.command || "")}`;
			case "Edit":
			case "edit":
				return `✏️ Editing ${friendlyPath(args?.path)}`;
			case "Write":
			case "write":
				return `📝 Writing ${friendlyPath(args?.path)}`;
			case "todo":
				return `📋 Todo: ${args?.action || "managing"}`;
			default:
				return `🔧 ${toolName}`;
		}
	}

	function friendlyPath(p: string | undefined): string {
		if (!p) return "file";
		const parts = p.split("/").filter(Boolean);
		const filename = parts[parts.length - 1] || p;
		// Return just the filename for readability
		return `\`${filename}\``;
	}

	function describeBashCommand(cmd: string): string {
		// Strip common prefixes like cd, eval mise, etc.
		const cleaned = cmd
			.replace(/^cd\s+[^\s;&&]+\s*[;&|]+\s*/g, "")
			.replace(/^eval\s+"\$\(mise\s+env[^)]*\)"\s*[;&|]+\s*/g, "")
			.replace(/^\s*export\s+\S+\s*[;&|]+\s*/g, "")
			.trim();

		// Match common patterns and describe them
		const patterns: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
			[/^kubectl\s+get\s+nodes/, "Checking cluster nodes"],
			[/^kubectl\s+get\s+pods/, "Checking pods"],
			[/^kubectl\s+get\s+(deploy|deployment)/, "Checking deployments"],
			[/^kubectl\s+get\s+(\S+)/, (m) => `Checking ${m[1]}`],
			[/^kubectl\s+scale\s+.*--replicas=(\d+)/, (m) => m[1] === "0" ? "Scaling down" : "Scaling up"],
			[/^kubectl\s+exec\s+.*cat\s+(\S+)/, (m) => `Reading ${friendlyPath(m[1])} on server`],
			[/^kubectl\s+exec\s+.*git\s+.*commit/, "Committing on server"],
			[/^kubectl\s+exec\s+.*git\s+.*push/, "Pushing to git"],
			[/^kubectl\s+exec\s+.*git\s+.*status/, "Checking git status on server"],
			[/^kubectl\s+cp\s+/, "Copying file to server"],
			[/^kubectl\s+port-forward/, "Port forwarding"],
			[/^kubectl\s+delete\s+pod/, "Cleaning up temp pod"],
			[/^kubectl\s+wait/, "Waiting for pod readiness"],
			[/^kubectl\s+apply/, "Applying Kubernetes manifest"],
			[/^flux\s+get\s+kustomizations/, "Checking Flux kustomizations"],
			[/^flux\s+get\s+helmreleases/, "Checking Helm releases"],
			[/^grep\s+-r/, "Searching files"],
			[/^find\s+/, "Finding files"],
			[/^ls\s+/, "Listing directory"],
			[/^cat\s+/, "Reading file"],
			[/^python3?\s+.*ws\.py/, "Querying HA websocket API"],
			[/^python3?\s+.*lovelace\.py/, "Updating dashboard"],
			[/^\$HA\s+call\s+(\S+)\s+(\S+)/, (m) => `Calling HA ${m[1]}.${m[2]}`],
			[/^\$HA\s+(states|state)\s+/, "Checking HA entity states"],
			[/^\$HA\s+template/, "Running HA template"],
			[/^\$HA\s+check-config/, "Validating HA config"],
			[/^HA=.*?\$HA\s+call\s+(\S+)\s+(\S+)/, (m) => `Calling HA ${m[1]}.${m[2]}`],
			[/^HA=.*?\$HA\s+(states|state)/, "Checking HA entity states"],
			[/^HA=.*?\$HA\s+template/, "Running HA template"],
			[/^HA=.*?\$HA\s+check-config/, "Validating HA config"],
			[/ha-deploy/, "Deploying to Home Assistant"],
			[/ha-dash/, "Updating HA dashboard"],
			[/^git\s+status/, "Checking git status"],
			[/^git\s+diff/, "Checking git diff"],
			[/^git\s+log/, "Checking git log"],
			[/^git\s+commit/, "Committing changes"],
			[/^git\s+push/, "Pushing changes"],
			[/^git\s+pull/, "Pulling changes"],
			[/^jj\s+/, "Running jj command"],
			[/^docker\s+/, "Running Docker command"],
			[/^go\s+build/, "Building Go project"],
			[/^go\s+test/, "Running Go tests"],
			[/^npm\s+/, "Running npm"],
			[/^yarn\s+/, "Running yarn"],
			[/^pnpm\s+/, "Running pnpm"],
			[/mosquitto/, "MQTT operation"],
			[/^kill\s+/, "Cleaning up process"],
			[/^sleep\s+/, "Waiting"],
		];

		for (const [pattern, result] of patterns) {
			const match = cleaned.match(pattern);
			if (match) {
				return typeof result === "function" ? result(match) : result;
			}
		}

		// Fallback: show first meaningful command, truncated
		const short = cleaned.length > 50 ? cleaned.slice(0, 47) + "..." : cleaned;
		return `Running \`${short}\``;
	}

	function buildActivityText(): string {
		if (activityLines.length === 0) return "⏳ Thinking...";

		// Show last 6 actions with the most recent highlighted
		const display = activityLines.slice(-6);
		const lines: string[] = [];

		for (let i = 0; i < display.length; i++) {
			const isLast = i === display.length - 1;
			if (isLast) {
				lines.push(`▶ ${display[i]}`);
			} else {
				lines.push(`✓ ${display[i]}`);
			}
		}

		if (activityLines.length > 6) {
			const hidden = activityLines.length - 6;
			lines.unshift(`_…${hidden} earlier step${hidden > 1 ? "s" : ""}_`);
		}

		return lines.join("\n");
	}

	async function startActivityFeed(): Promise<void> {
		if (!isConnected || activeChatIds.size === 0) return;

		activityLines = [];
		activityMsgIds.clear();
		lastEditTime = 0;
		pendingEdit = false;

		for (const chatId of activeChatIds) {
			try {
				const result = await sendMessage(chatId, "⏳ Thinking...");
				if (result?.message_id) {
					activityMsgIds.set(chatId, result.message_id);
				}
			} catch (e: any) {
				console.error(`[telegram-bot] Failed to send activity message: ${e?.message || e}`);
			}
		}
	}

	function pushActivity(line: string): void {
		activityLines.push(line);
		scheduleActivityEdit();
	}

	function scheduleActivityEdit(): void {
		if (activityMsgIds.size === 0) return;

		const now = Date.now();
		const elapsed = now - lastEditTime;

		if (elapsed >= MIN_EDIT_INTERVAL_MS) {
			// Can edit now
			flushActivityEdit();
		} else if (!pendingEdit) {
			// Schedule for later
			pendingEdit = true;
			const delay = MIN_EDIT_INTERVAL_MS - elapsed;
			editTimer = setTimeout(() => {
				pendingEdit = false;
				flushActivityEdit();
			}, delay);
		}
		// If pendingEdit is already true, the scheduled flush will pick up the latest state
	}

	function flushActivityEdit(): void {
		// Skip edits entirely when rate-limited
		if (rateLimitedUntil > 0 && Date.now() < rateLimitedUntil) return;

		lastEditTime = Date.now();
		const text = buildActivityText();

		for (const [chatId, msgId] of activityMsgIds) {
			tgApi("editMessageText", {
				chat_id: chatId,
				message_id: msgId,
				text,
			}).catch((e: any) => {
				// If this edit itself triggers rate limiting, stop future edits until cleared
				if (e?.message?.includes("429") || e?.message?.toLowerCase()?.includes("too many")) {
					console.error(`[telegram-bot] Activity edit rate-limited, pausing edits`);
				}
			});
		}
	}

	async function stopActivityFeed(): Promise<void> {
		if (editTimer) {
			clearTimeout(editTimer);
			editTimer = null;
		}
		pendingEdit = false;

		// Delete the activity messages
		for (const [chatId, msgId] of activityMsgIds) {
			tgApi("deleteMessage", {
				chat_id: chatId,
				message_id: msgId,
			}).catch(() => {});
		}
		activityMsgIds.clear();
		activityLines = [];
	}

	// ── Telegram Polling ──────────────────────────────────────────────

	async function startPolling(): Promise<void> {
		let offset = 0;

		while (isConnected) {
			try {
				const updates = await tgApi(
					"getUpdates",
					{ offset, timeout: 30 },
					pollAbort?.signal,
				);

				for (const update of updates) {
					offset = update.update_id + 1;

					if (!isConnected) break;

					const msg = update.message;
					if (msg?.voice) {
						handleVoiceMessage(msg.chat.id, msg.voice.file_id, msg.caption);
					} else if (msg?.photo) {
						// photo is array of sizes — use the largest
						const photo = msg.photo[msg.photo.length - 1];
						handlePhotoMessage(msg.chat.id, photo.file_id, msg.caption);
					} else if (msg?.document && msg.document.mime_type?.startsWith("image/")) {
						handlePhotoMessage(msg.chat.id, msg.document.file_id, msg.caption);
					} else if (msg?.text) {
						handleTelegramMessage(msg.chat.id, msg.text);
					}
				}
			} catch (e: any) {
				if (e.name === "AbortError" || !isConnected) break;
				const errMsg = e?.message || String(e);
				for (const chatId of activeChatIds) {
					tgApi("sendMessage", { chat_id: chatId, text: `⚠️ Telegram polling error: ${errMsg}\nRetrying in 5s…` }).catch(() => {});
				}
				await new Promise((r) => setTimeout(r, 5000));
			}
		}
	}

	function downloadFileToBuffer(url: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			https.get(url, { family: 4 }, (res) => {
				if (res.statusCode === 301 || res.statusCode === 302) {
					downloadFileToBuffer(res.headers.location!).then(resolve, reject);
					return;
				}
				const chunks: Buffer[] = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => resolve(Buffer.concat(chunks)));
			}).on("error", reject);
		});
	}

	function mimeFromPath(filePath: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
		const ext = filePath.split(".").pop()?.toLowerCase();
		if (ext === "png") return "image/png";
		if (ext === "gif") return "image/gif";
		if (ext === "webp") return "image/webp";
		return "image/jpeg";
	}

	async function handlePhotoMessage(chatId: number, fileId: string, caption?: string): Promise<void> {
		if (!isConnected) return;
		if (allowedChatId && chatId !== allowedChatId) return;

		activeChatIds.add(chatId);
		messageCount.received++;

		tgApi("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});

		try {
			const fileInfo = await tgApi("getFile", { file_id: fileId });
			const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
			const buffer = await downloadFileToBuffer(fileUrl);
			const base64 = buffer.toString("base64");
			const mediaType = mimeFromPath(fileInfo.file_path);

			const content: any[] = [
				{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
			];
			if (caption?.trim()) {
				content.unshift({ type: "text", text: caption.trim() });
			}

			let deliverAs: "steer" | "followUp" | undefined;
			if (agentBusy) {
				deliverAs = "followUp";
			}

			const opts = deliverAs ? { deliverAs } : undefined;
			pi.sendUserMessage(content, opts);

			if (deliverAs && agentBusy) {
				sendFinalMessage(chatId, "📋 Queued as follow-up").catch(() => {});
			}
		} catch (e: any) {
			const errMsg = e?.message || String(e);
			sendFinalMessage(chatId, `⚠️ Failed to process image: ${errMsg}`).catch(() => {});
		}
	}

	async function handleVoiceMessage(chatId: number, fileId: string, caption?: string): Promise<void> {
		if (!isConnected) return;
		if (allowedChatId && chatId !== allowedChatId) return;

		activeChatIds.add(chatId);
		messageCount.received++;

		tgApi("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});

		try {
			const transcription = await transcribeVoice(fileId);
			await sendFinalMessage(chatId, `🎙️ _${transcription}_`);
			const prompt = caption ? `${caption}\n\n${transcription}` : transcription;
			handleTelegramMessage(chatId, prompt);
		} catch (e: any) {
			const errMsg = e?.message || String(e);
			sendFinalMessage(chatId, `⚠️ Voice transcription failed: ${errMsg}`).catch(() => {});
		}
	}

	function handleTelegramMessage(chatId: number, text: string): void {
		if (!isConnected) return;
		if (allowedChatId && chatId !== allowedChatId) return;

		activeChatIds.add(chatId);
		messageCount.received++;

		if (text.match(/^\/abort\b/i)) {
			if (!agentBusy) {
				sendFinalMessage(chatId, "ℹ️ Agent is not currently running.").catch(() => {});
				return;
			}
			if (latestCtx?.abort) {
				latestCtx.abort();
				sendFinalMessage(chatId, "🛑 Aborting current operation…").catch(() => {});
			} else {
				sendFinalMessage(chatId, "⚠️ Cannot abort — no active context available.").catch(() => {});
			}
			return;
		}

		if (text.match(/^\/start\b/i)) {
			sendFinalMessage(chatId, "🟢 Connected to Pi. Send a message to get started.").catch(() => {});
			return;
		}

		let deliverAs: "steer" | "followUp" | undefined;
		let messageText = text;

		const steerMatch = messageText.match(/^\/steer\b\s*/i);
		const followUpMatch = messageText.match(/^\/follow\s*up\b\s*/i);

		if (steerMatch) {
			deliverAs = "steer";
			messageText = messageText.slice(steerMatch[0].length);
		} else if (followUpMatch) {
			deliverAs = "followUp";
			messageText = messageText.slice(followUpMatch[0].length);
		} else if (agentBusy) {
			deliverAs = "followUp";
		}

		if (!messageText.trim()) {
			sendFinalMessage(chatId, "⚠️ Empty message after prefix. Usage:\n`/steer <message>` — interrupt the agent\n`/followup <message>` — queue after agent finishes").catch(() => {});
			return;
		}

		tgApi("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});

		try {
			const opts = deliverAs ? { deliverAs } : undefined;
			pi.sendUserMessage(messageText, opts);

			if (deliverAs && agentBusy) {
				const mode = deliverAs === "steer" ? "🔀 Steering" : "📋 Queued as follow-up";
				sendFinalMessage(chatId, `${mode}`).catch(() => {});
			}
		} catch (e: any) {
			const errMsg = e?.message || String(e);
			sendFinalMessage(chatId, `⚠️ Failed to deliver message to Pi: ${errMsg}`).catch(() => {});
		}
	}

	// ── Connect / Disconnect ──────────────────────────────────────────

	async function connect(t: string): Promise<void> {
		token = t;
		pollAbort = new AbortController();

		const me = await tgApi("getMe");
		botUsername = me.username;

		isConnected = true;
		messageCount = { sent: 0, received: 0 };

		try {
			await tgApi("setMyCommands", {
				commands: [
					{ command: "abort", description: "Stop the current agent operation" },
					{ command: "steer", description: "Interrupt the agent and redirect — /steer <message>" },
					{ command: "followup", description: "Queue a message for after the agent finishes — /followup <message>" },
				],
			});
		} catch {}

		try {
			const updates = await tgApi("getUpdates", { offset: -1 });
			if (updates.length > 0) {
				await tgApi("getUpdates", { offset: updates[updates.length - 1].update_id + 1 });
			}
		} catch {}

		if (allowedChatId) {
			activeChatIds.add(allowedChatId);
			// Non-fatal — bot may be temporarily rate-limited
			sendFinalMessage(
				allowedChatId,
				"🟢 Pi connected.\nSend messages here to control your terminal session.",
			).catch(() => {});
		}

		startPolling().catch((e) => {
			console.error(`[telegram-bot] Polling loop exited with error: ${e?.message || e}`);
		});
	}

	function disconnect(): void {
		const prevChatIds = new Set(activeChatIds);

		isConnected = false;
		stopActivityFeed();
		pollAbort?.abort();
		pollAbort = null;

		if (token) {
			for (const chatId of prevChatIds) {
				tgApi("sendMessage", { chat_id: chatId, text: "🔴 Pi disconnected." }).catch(() => {});
			}
		}

		activeChatIds.clear();
		token = null;
		botUsername = "";
	}

	// ── Pi Events ─────────────────────────────────────────────────────

	pi.on("before_agent_start", async (event, _ctx) => {
		if (!isConnected || activeChatIds.size === 0) return;

		const telegramInstructions = `

## Telegram Output Mode

Your response will be forwarded to Telegram. Format ALL responses using Telegram MarkdownV1 rules:

**Allowed formatting:**
- *bold* (single asterisks)
- _italic_ (single underscores)
- \`inline code\` (backticks)
- \`\`\`code blocks\`\`\` (triple backticks, no language hint)
- [link text](url)

**Forbidden formatting (will break rendering):**
- **NO** double asterisks (**bold**) — use *single asterisks*
- **NO** headers (#, ##, ###) — use *bold text* instead
- **NO** tables — use plain text alignment or lists
- **NO** bullet points with - or * at line start — use • (bullet character) or numbered lists
- **NO** language hints on code blocks (\`\`\`python) — use plain \`\`\` only
- **NO** nested formatting (*_bold italic_*) — keep it simple
- **NO** horizontal rules (---)
- **NO** blockquotes (>)

**Style guidelines:**
- Keep responses concise — Telegram messages over 4096 chars get split
- Use blank lines to separate sections
- Use \`inline code\` for file paths, commands, function names
- Use code blocks for multi-line code or output
- Prefer short paragraphs over long walls of text
`;

		return {
			systemPrompt: event.systemPrompt + telegramInstructions,
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		latestCtx = ctx;
		if (isConnected) updateStatus(ctx);
	});

	pi.on("agent_start", async (_event, ctx) => {
		agentBusy = true;
		latestCtx = ctx;
		if (isConnected) {
			startActivityFeed();
			updateStatus(ctx);
		}
	});

	// Track tool activity for the live feed
	pi.on("tool_execution_start", async (event, _ctx) => {
		if (!isConnected || activeChatIds.size === 0) return;
		const line = formatToolAction(event.toolName, event.args);
		pushActivity(line);
	});

	pi.on("agent_end", async (event, ctx) => {
		agentBusy = false;

		if (!isConnected || activeChatIds.size === 0) {
			await stopActivityFeed();
			updateStatus(ctx);
			return;
		}

		// Brief pause to let the last edit land before we delete
		await new Promise((r) => setTimeout(r, 500));
		await stopActivityFeed();

		// Extract text from only the LAST assistant message (the final summary),
		// skipping intermediate narration between tool calls.
		const textParts: string[] = [];
		const lastAssistantMsg = [...event.messages].reverse().find(
			(msg) => msg.role === "assistant" && Array.isArray(msg.content) &&
				msg.content.some((b: any) => b.type === "text" && b.text?.trim())
		);
		if (lastAssistantMsg && Array.isArray(lastAssistantMsg.content)) {
			for (const block of lastAssistantMsg.content) {
				if (block.type === "text" && block.text?.trim()) {
					textParts.push(block.text);
				}
			}
		}

		const fullResponse = textParts.join("\n\n");

		if (fullResponse.trim()) {
			await sendToAllChats(fullResponse);
		} else {
			await sendToAllChats("ℹ️ Done (no text output — tools only).");
		}

		updateStatus(ctx);
	});

	pi.on("session_shutdown", async () => {
		if (isConnected) disconnect();
	});

	pi.on("session_switch", async (_event, ctx) => {
		if (isConnected && activeChatIds.size > 0) {
			await sendToAllChats("ℹ️ Pi session switched.");
		}
		updateStatus(ctx);
	});

	// ── Status Display ────────────────────────────────────────────────

	function updateStatus(ctx: any): void {
		if (!isConnected) {
			ctx.ui.setStatus("telegram-bot", undefined);
			return;
		}
		const theme = ctx.ui.theme;

		let rateLimitText = "";
		if (rateLimitedUntil > 0) {
			const secsLeft = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
			if (secsLeft > 0) {
				const mins = Math.floor(secsLeft / 60);
				const secs = secsLeft % 60;
				const timeStr = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
				rateLimitText = theme.fg("error", ` ⛔ rate limited ${timeStr}`);
			}
		}

		const dot = rateLimitText
			? theme.fg("error", "●")
			: agentBusy
				? theme.fg("warning", "●")
				: theme.fg("success", "●");
		const name = theme.fg("dim", ` @${botUsername}`);
		const chats = activeChatIds.size > 0
			? theme.fg("dim", ` (${activeChatIds.size} chat${activeChatIds.size > 1 ? "s" : ""})`)
			: "";
		ctx.ui.setStatus("telegram-bot", `📱${dot}${name}${chats}${rateLimitText}`);
	}

	// ── Command ───────────────────────────────────────────────────────

	pi.registerCommand("telegram-bot", {
		description: "Connect/disconnect Telegram Bot for remote control",
		handler: async (args, ctx) => {
			const arg = args.trim();

			if (arg === "status") {
				if (!isConnected) {
					ctx.ui.notify("Telegram Bot: not connected", "info");
				} else {
					ctx.ui.notify(
						`Telegram Bot: @${botUsername}\n` +
						`Chats: ${activeChatIds.size} | ` +
						`Sent: ${messageCount.sent} | Received: ${messageCount.received}\n` +
						`Mode: activity feed + final message`,
						"info",
					);
				}
				return;
			}

			if (arg === "stop") {
				if (!isConnected) {
					ctx.ui.notify("Telegram Bot is not connected", "warning");
					return;
				}
				disconnect();
				ctx.ui.setStatus("telegram-bot", undefined);
				ctx.ui.notify("Telegram Bot disconnected", "info");
				return;
			}

			if (isConnected && !arg) {
				disconnect();
				ctx.ui.setStatus("telegram-bot", undefined);
				ctx.ui.notify("Telegram Bot disconnected", "info");
				return;
			}

			const t = arg || process.env.TELEGRAM_BOT_TOKEN;
			if (!t) {
				ctx.ui.notify(
					"No token provided. Use: /telegram-bot <token>\n" +
					"Or set TELEGRAM_BOT_TOKEN environment variable",
					"error",
				);
				return;
			}

			const chatIdEnv = process.env.TELEGRAM_CHAT_ID;
			if (chatIdEnv) {
				allowedChatId = parseInt(chatIdEnv, 10);
				if (isNaN(allowedChatId)) {
					ctx.ui.notify("Invalid TELEGRAM_CHAT_ID value", "error");
					allowedChatId = null;
					return;
				}
			}

			try {
				await connect(t);
				updateStatus(ctx);

				const chatIdNote = allowedChatId
					? `Restricted to chat ID: ${allowedChatId}`
					: "Accepting messages from any chat (set TELEGRAM_CHAT_ID to restrict)";

				ctx.ui.notify(
					`🤖 Telegram Bot connected: @${botUsername}\n` +
					`📨 Activity feed + final message mode\n` +
					`${chatIdNote}`,
					"info",
				);
			} catch (e: any) {
				ctx.ui.notify(`Failed to connect: ${e.message}`, "error");
			}
		},
	});
}
