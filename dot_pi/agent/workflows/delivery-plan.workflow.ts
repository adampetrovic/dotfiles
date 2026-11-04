import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Ordinary imports are not included in the runtime source hash. Pin the helper so
// changing it also requires changing each workflow, invalidating saved definitions.
const helperHash = createHash("sha256").update(readFileSync(new URL("./lib/personal.ts", import.meta.url))).digest("hex");
if (helperHash !== "907af8a2edca74c681b8788c0c5100bfbb0c5b892c593172d3d5a83b2f6125f1") {
  throw new Error("Personal workflow helper changed; update its hash in all three workflow definitions before starting a new run.");
}
import { agent, compute, defineWorkflow } from "@osolmaz/pi-workflows";
import { input, prompt, practical, timeoutMs, validatePlan, validateReview, planShape, reviewShape,
  assess, type Ledger, type Plan, type Review } from "./lib/personal";
export default defineWorkflow({
  name: "delivery-plan",
  source: import.meta.url,
  input: (value) => input(value),
  startAt: "draft",
  maxSteps: 26,
  nodes: {
    draft: agent({
      timeoutMs,
      prompt: (c) => prompt(c, `Read-only planning: do not edit files or execute mutating commands.
${practical}
Revise any prior plan to address all review findings. Do not repeat failed approaches unchanged.
If blocked, keep any usable partial plan and state the concrete question.`),
      expectedOutput: planShape, validate: validatePlan,
    }),
    review: agent({
      timeoutMs,
      prompt: (c) => prompt(c, `Read-only review of the latest draft against repository evidence and task.
Check feasibility, scope, ordered steps and acceptance criteria. Do not implement or create files.
A blocked draft must remain blocked: return its concrete question. Return pass only for a usable plan
without unresolved findings or user decisions; otherwise fix with actionable findings, or blocked.
Include evidence and carry forward unresolved prior findings.`),
      expectedOutput: reviewShape, validate: validateReview,
    }),
    assess: compute({ run: (c) => {
      const plan = c.outputs.draft as Plan;
      const review = c.outputs.review as Review;
      const effective = plan.status === "blocked" ? { ...review, status: "blocked" as const, question: plan.question, summary: plan.summary } : review;
      return assess(c, effective, plan);
    } }),
    done: compute({ run: ({ outputs }) => {
      const a = outputs.assess as Ledger;
      const plan = outputs.draft as Plan;
      return { status: a.status, summary: a.summary, rounds: a.round, plan: plan.plan,
        evidence: plan.evidence, review: outputs.review, question: plan.question || (outputs.review as Review).question };
    } }),
  },
  edges: [
    { from: "draft", to: "review" }, { from: "review", to: "assess" },
    { from: "assess", switch: { on: "$.route", cases: { again: "draft", done: "done" } } },
  ],
});
