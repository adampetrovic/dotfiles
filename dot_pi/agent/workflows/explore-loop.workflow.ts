import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Ordinary imports are not included in the runtime source hash. Pin the helper so
// changing it also requires changing each workflow, invalidating saved definitions.
const helperHash = createHash("sha256").update(readFileSync(new URL("./lib/personal.ts", import.meta.url))).digest("hex");
if (helperHash !== "907af8a2edca74c681b8788c0c5100bfbb0c5b892c593172d3d5a83b2f6125f1") {
  throw new Error("Personal workflow helper changed; update its hash in all three workflow definitions before starting a new run.");
}
import { agent, compute, defineWorkflow } from "@osolmaz/pi-workflows";
import { input, object, string, strings, oneOf, prompt, timeoutMs, type Input, type Ledger } from "./lib/personal";
type Finding = {
  status: "enough" | "more" | "blocked"; summary: string; recommendation: string;
  evidence: string[]; uncertainty: string[]; nextAction: string; questions: string[];
};
export default defineWorkflow({
  name: "explore-loop",
  source: import.meta.url,
  input: (value) => input(value),
  startAt: "investigate",
  maxSteps: 26,
  nodes: {
    investigate: agent({
      timeoutMs,
      prompt: (c) => prompt(c, `Read-only investigation: do not edit files or run mutating commands.
Investigate targeted technical questions from prior findings. Assess whether evidence is enough for a practical recommendation.
Use enough when ready, more only for questions you can investigate next, blocked for a concrete user decision.
Return a concise recommendation with file/line or command evidence, remaining uncertainty and next action.
Blocked questions must be addressed to the user; never wait automatically.`),
      expectedOutput: '{status:"enough"|"more"|"blocked",summary:string,recommendation:string,evidence:string[],uncertainty:string[],nextAction:string,questions:string[]}',
      validate: (value): Finding => {
        const v = object(value);
        const result: Finding = {
          status: oneOf(v.status, ["enough", "more", "blocked"]), summary: string(v.summary, "summary"),
          recommendation: string(v.recommendation, "recommendation"), evidence: strings(v.evidence, "evidence"),
          uncertainty: strings(v.uncertainty, "uncertainty"), nextAction: string(v.nextAction, "nextAction"),
          questions: strings(v.questions, "questions"),
        };
        if (result.status !== "enough" && !result.questions.length) throw new Error("More/blocked requires concrete questions");
        if (result.status === "enough" && !result.evidence.length) throw new Error("Enough requires evidence");
        return result;
      },
    }),
    assess: compute({ run: ({ input, outputs }) => {
      const finding = outputs.investigate as Finding;
      const previous = outputs.assess as Ledger | undefined;
      const history = [...(previous?.history ?? []), finding];
      const repeated = (previous?.history ?? []).some((f) => JSON.stringify(f) === JSON.stringify(finding));
      const exhausted = history.length >= (input as Input).maxRounds;
      return { round: history.length, history,
        route: finding.status !== "more" || repeated || exhausted ? "done" : "again",
        status: finding.status === "enough" ? "complete" : finding.status === "blocked" ? "blocked" : "incomplete",
        summary: finding.summary + (finding.status === "more" ? repeated ? " Unchanged findings repeated; stopped." : exhausted ? " Investigation budget exhausted." : "" : ""),
      };
    } }),
    done: compute({ run: ({ outputs }) => {
      const a = outputs.assess as Ledger;
      const f = outputs.investigate as Finding;
      return { status: a.status, summary: a.summary, rounds: a.round,
        recommendation: f.recommendation, evidence: f.evidence, uncertainty: f.uncertainty,
        nextAction: f.nextAction, questions: f.questions };
    } }),
  },
  edges: [
    { from: "investigate", to: "assess" },
    { from: "assess", switch: { on: "$.route", cases: { again: "investigate", done: "done" } } },
  ],
});
