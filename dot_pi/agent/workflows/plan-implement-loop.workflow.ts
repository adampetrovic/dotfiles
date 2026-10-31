import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Ordinary imports are not included in the runtime source hash. Pin the helper so
// changing it also requires changing each workflow, invalidating saved definitions.
const helperHash = createHash("sha256").update(readFileSync(new URL("./lib/personal.ts", import.meta.url))).digest("hex");
if (helperHash !== "907af8a2edca74c681b8788c0c5100bfbb0c5b892c593172d3d5a83b2f6125f1") {
  throw new Error("Personal workflow helper changed; update its hash in all three workflow definitions before starting a new run.");
}
import { agent, choice, compute, defineHumanChoices, defineWorkflow, humanDecision,
  humanDecisionEdge, textInput } from "@osolmaz/pi-workflows";
import { input, prompt, practical, timeoutMs, validatePlan, validateReview, validateWork,
  planShape, reviewShape, workShape, assess, type Input, type Ledger, type Plan, type Review, type Work } from "./lib/personal";
const choices = defineHumanChoices({
  approve: choice({ label: "Approve implementation" }),
  revise: choice({ label: "Revise plan", input: textInput({ name: "feedback", prompt: "What must change?", minLength: 1, maxLength: 4000 }) }),
  stop: choice({ label: "Stop without implementing" }),
});
type Planning = { round: number; history: Plan[]; route: "approval" | "stop"; status: string; summary: string };
export default defineWorkflow({
  name: "plan-implement-loop",
  source: import.meta.url,
  input: (value) => input(value, true),
  startAt: "plan",
  maxSteps: 68,
  nodes: {
    plan: agent({
      timeoutMs,
      prompt: (c) => prompt(c, `Read-only planning. No code edits or mutating commands before operator approval.
${practical}
If input.plan exists it is inline plan text or a path: inspect the path when it identifies a file, and read it.
Draft/adapt the practical plan for this task. Address any approval revision feedback and preserve previous findings.
Do not request approval yourself; the protected operator gate follows. If a real user decision is unresolved,
return blocked with a concrete question and any usable partial plan.`),
      expectedOutput: planShape, validate: validatePlan,
    }),
    assessPlan: compute({ run: ({ outputs }) => {
      const plan = outputs.plan as Plan;
      const previous = outputs.assessPlan as Planning | undefined;
      const history = [...(previous?.history ?? []), plan];
      const unchanged = (previous?.history ?? []).some((p) => p.plan === plan.plan);
      return { round: history.length, history, route: plan.status === "blocked" || unchanged ? "stop" : "approval",
        status: plan.status === "blocked" ? "blocked" : "incomplete",
        summary: unchanged ? "Plan unchanged after revision feedback; stopped without implementation." : plan.summary };
    } }),
    approval: humanDecision({
      audience: "operator", choices,
      request: ({ outputs }) => ({
        title: "Approve this implementation plan",
        subject: outputs.plan,
        presentation: { schema: "pi-workflows.decision-presentation.v1",
          summary: "Approve code changes, request a revision, or stop. Approval does not authorize pushing, publishing or destructive operations.",
          blocks: [{ kind: "paragraph", text: (outputs.plan as Plan).plan },
            { kind: "paragraph", text: `Evidence: ${JSON.stringify((outputs.plan as Plan).evidence)}` }] },
      }),
      // No onTimeout: only a verified operator response can authorize edits.
    }),
    revisePlan: compute({ run: ({ input, outputs }) => ({
      route: (outputs.assessPlan as Planning).round >= (input as Input).maxRounds ? "stop" : "plan",
      summary: "Planning revision budget exhausted; no implementation started.",
    }) }),
    planningStopped: compute({ run: ({ outputs }) => ({
      status: (outputs.assessPlan as Planning).status,
      summary: (outputs.assessPlan as Planning).route === "stop" ? (outputs.assessPlan as Planning).summary : (outputs.revisePlan as { summary: string }).summary,
      plan: (outputs.plan as Plan).plan, question: (outputs.plan as Plan).question,
      planningRounds: (outputs.assessPlan as Planning).round, reviewRounds: 0,
    }) }),
    stopped: compute({ run: ({ outputs }) => ({ status: "stopped", summary: "Operator stopped before implementation.", plan: (outputs.plan as Plan).plan }) }),
    implement: agent({
      timeoutMs,
      prompt: (c) => prompt(c, `Implement ONLY the latest operator-approved plan. On later rounds fix review findings within that approved scope.
If a scope/plan change needs a user decision, return blocked with a concrete question; do not silently replan.
Preserve unrelated changes and follow local jj conventions before editing. Inspect current changes before repeating work.
Run project-native checks and record actual commands, outcomes and evidence. Never count skipped, failed or unavailable
checks as passing; document reasons. Keep previous feedback and check failures visible. Return blocked for uncertainty
requiring the user; otherwise ready for an independent review, even if checks still have fixable failures.`),
      expectedOutput: workShape, validate: validateWork,
    }),
    review: agent({
      timeoutMs,
      prompt: (c) => prompt(c, `Launch a SEPARATE read-only Review subagent to review the actual changes against the approved plan,
local AGENTS.md, and test evidence. Do not review your own work as a substitute. Instruct it not to edit, fix, push,
publish or run mutating commands. It must inspect the actual diff and verify command/check evidence, flag correctness
issues and missing validation, and retain unresolved earlier findings. If the Review subagent cannot run or fails,
return blocked with a concrete question; never pass. Relay its findings faithfully, citing file/line and command evidence.
Passing requires no unresolved findings, no failed/skipped required checks and adequate verified project-native validation.
Missing or inconclusive evidence blocks completion. Work marked blocked must stay blocked with its question.`),
      expectedOutput: reviewShape, validate: validateReview,
    }),
    assess: compute({ run: (c) => {
      const work = c.outputs.implement as Work;
      let review = c.outputs.review as Review;
      if (work.status === "blocked") review = { ...review, status: "blocked", question: work.question, summary: work.summary };
      else if (review.status === "pass" && work.checks.some((check) => check.outcome !== "passed")) {
        review = { ...review, status: "fix", summary: "Validation remains incomplete.",
          findings: work.checks.filter((check) => check.outcome !== "passed").map((check) => `${check.command}: ${check.outcome}: ${check.detail}`) };
      }
      return assess(c, review, work);
    } }),
    done: compute({ run: ({ outputs }) => {
      const a = outputs.assess as Ledger;
      const work = outputs.implement as Work;
      return { status: a.status, summary: a.summary, planningRounds: (outputs.assessPlan as Planning).round,
        reviewRounds: a.round, changes: work.summary, checks: work.checks, evidence: work.evidence,
        review: outputs.review, question: work.question || (outputs.review as Review).question };
    } }),
  },
  edges: [
    { from: "plan", to: "assessPlan" },
    { from: "assessPlan", switch: { on: "$.route", cases: { approval: "approval", stop: "planningStopped" } } },
    humanDecisionEdge({ from: "approval", choices, cases: { approve: "implement", revise: "revisePlan", stop: "stopped" } }),
    { from: "revisePlan", switch: { on: "$.route", cases: { plan: "plan", stop: "planningStopped" } } },
    { from: "implement", to: "review" }, { from: "review", to: "assess" },
    { from: "assess", switch: { on: "$.route", cases: { again: "implement", done: "done" } } },
  ],
});
