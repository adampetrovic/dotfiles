/**
 * /review [revset]
 *
 * Opens Plannotator's code review on a chosen jj revision, so the diff does not depend on where `@` happens to be.
 *
 * Plannotator's jj sessions always open on `@` ("Current change") and refuse --base / --diff-type, and a patch file
 * would lose file content and "All files". So this command moves `@` for you, then runs /plannotator-review:
 *
 * - the revision is `@` itself: nothing moves, pick "Current change";
 * - `@` is an empty change: it is put on top of the revision (`jj new`), pick "Last change";
 * - `@` holds changes of its own: refuses, because `jj new` would swap the files on disk under it.
 *
 * With no argument the revision is `@` when it has changes, otherwise `@-`. Outside a jj repo, and for arguments
 * that are flags or URLs, the arguments go straight to /plannotator-review.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const JJ_FLAGS = ["--no-pager", "--color=never"];
const PASS_THROUGH = /^(-|https?:\/\/)/;

interface Rev {
	commitId: string;
	changeId: string;
	empty: boolean;
	description: string;
}

const REV_TEMPLATE = 'commit_id ++ "\\t" ++ change_id.short() ++ "\\t" ++ if(empty, "empty", "full") ++ "\\t" ++ description.first_line() ++ "\\n"';

export default function (pi: ExtensionAPI) {
	async function jj(cwd: string, args: string[]) {
		return pi.exec("jj", [...JJ_FLAGS, ...args], { cwd, timeout: 30_000 });
	}

	async function revs(cwd: string, revset: string): Promise<Rev[] | string> {
		const result = await jj(cwd, ["log", "--no-graph", "-r", revset, "-T", REV_TEMPLATE]);
		if (result.code !== 0) return result.stderr.trim() || `jj log failed for ${revset}`;
		return result.stdout
			.split("\n")
			.filter((line) => line.length > 0)
			.map((line) => {
				const [commitId, changeId, state, ...description] = line.split("\t");
				return { commitId, changeId, empty: state === "empty", description: description.join("\t") };
			});
	}

	async function one(cwd: string, revset: string): Promise<Rev | string> {
		const found = await revs(cwd, revset);
		if (typeof found === "string") return found;
		if (found.length !== 1) return `${revset} resolves to ${found.length} revisions; name exactly one`;
		return found[0];
	}

	async function open(ctx: ExtensionCommandContext, args: string) {
		// The command handler may run while the agent is busy; a queued message would reach the model as plain text.
		await ctx.waitForIdle();
		pi.sendUserMessage(`/plannotator-review${args ? ` ${args}` : ""}`, { expandPromptTemplates: true });
	}

	pi.registerCommand("review", {
		description: "Open Plannotator code review on a jj revision (default: @ if it has changes, else @-)",
		handler: async (rawArgs, ctx) => {
			const args = (rawArgs ?? "").trim();
			const cwd = ctx.cwd;

			const root = await jj(cwd, ["root"]);
			if (root.code !== 0 || PASS_THROUGH.test(args)) {
				await open(ctx, args);
				return;
			}

			const working = await one(cwd, "@");
			if (typeof working === "string") {
				ctx.ui.notify(`/review: ${working}`, "error");
				return;
			}
			const target = await one(cwd, args || (working.empty ? "@-" : "@"));
			if (typeof target === "string") {
				ctx.ui.notify(`/review: ${target}`, "error");
				return;
			}

			const label = `${target.changeId} ${target.description || "(no description)"}`;
			if (target.commitId === working.commitId) {
				ctx.ui.notify(`Reviewing ${label}. Pick "Current change" in the review UI.`, "info");
				await open(ctx, "");
				return;
			}

			if (!working.empty) {
				ctx.ui.notify(
					`/review: @ (${working.changeId}) has changes of its own, so \`jj new\` would swap the files under it. ` +
						"Finish or park it, or run /review from another workspace.",
					"error",
				);
				return;
			}

			const parents = await revs(cwd, "parents(@)");
			const alreadyOnTop = typeof parents !== "string" && parents.length === 1 && parents[0].commitId === target.commitId;
			if (!alreadyOnTop) {
				const created = await jj(cwd, ["new", target.commitId]);
				if (created.code !== 0) {
					ctx.ui.notify(`/review: jj new failed: ${created.stderr.trim()}`, "error");
					return;
				}
			}
			ctx.ui.notify(`Reviewing ${label}. Pick "Last change" in the review UI.`, "info");
			await open(ctx, "");
		},
	});
}
