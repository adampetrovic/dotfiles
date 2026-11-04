// Shared contracts only; each personal workflow owns its graph and budgets.
export type Input = { task: string; context?: string; maxRounds: number; plan?: string };
export type Context = { input: unknown; outputs: Record<string, unknown> };
export type Review = {
  status: "pass" | "fix" | "blocked"; summary: string;
  findings: string[]; evidence: string[]; question: string;
};
export type Plan = { status: "ready" | "blocked"; summary: string; plan: string; evidence: string[]; question: string };
export type Check = { command: string; outcome: "passed" | "failed" | "skipped"; detail: string };
export type Work = { status: "ready" | "blocked"; summary: string; evidence: string[]; question: string; checks: Check[] };
export type Ledger = { round: number; route: "again" | "done"; status: string; summary: string; history: unknown[] };
export const timeoutMs = 20 * 60_000;
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Record<string, unknown>;
}
export function string(value: unknown, name: string, nonempty = true): string {
  if (typeof value !== "string" || (nonempty && !value.trim())) throw new Error(`${name} must be ${nonempty ? "nonempty " : ""}text`);
  return value;
}
export function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((v) => string(v, name));
}
export function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new Error(`Expected one of ${values.join(", ")}`);
  return value as T;
}
export function input(value: unknown, implementation = false): Input {
  const v = object(value);
  const rounds = v.maxRounds === undefined ? 3 : v.maxRounds;
  if (!Number.isInteger(rounds) || (rounds as number) < 1 || (rounds as number) > 8) throw new Error("maxRounds must be an integer from 1 to 8");
  if (!implementation && v.plan !== undefined) throw new Error("plan is only supported by plan-implement-loop");
  return { task: string(v.task, "task"), maxRounds: rounds as number,
    ...(v.context === undefined ? {} : { context: string(v.context, "context", false) }),
    ...(v.plan === undefined ? {} : { plan: string(v.plan, "plan") }) };
}
export function validatePlan(value: unknown): Plan {
  const v = object(value);
  const result: Plan = { status: oneOf(v.status, ["ready", "blocked"]), summary: string(v.summary, "summary"),
    plan: string(v.plan, "plan"), evidence: strings(v.evidence, "evidence"), question: string(v.question, "question", false) };
  if (result.status === "blocked" && !result.question.trim()) throw new Error("Blocked plans require a concrete question");
  if (result.status === "ready" && (!result.evidence.length || result.question.trim())) throw new Error("Ready plans need evidence and no unresolved user question");
  return result;
}
export function validateReview(value: unknown): Review {
  const v = object(value);
  const result: Review = { status: oneOf(v.status, ["pass", "fix", "blocked"]), summary: string(v.summary, "summary"),
    findings: strings(v.findings, "findings"), evidence: strings(v.evidence, "evidence"), question: string(v.question, "question", false) };
  if (!result.evidence.length) throw new Error("Review requires evidence");
  if (result.status === "pass" && (result.findings.length || result.question.trim())) throw new Error("Passing reviews cannot have unresolved findings/questions");
  if (result.status === "fix" && !result.findings.length) throw new Error("Fix requires findings");
  if (result.status === "blocked" && !result.question.trim()) throw new Error("Blocked reviews require a concrete question");
  return result;
}
export function validateWork(value: unknown): Work {
  const v = object(value);
  if (!Array.isArray(v.checks) || !v.checks.length) throw new Error("checks must document checks, including any skipped checks");
  const result: Work = { status: oneOf(v.status, ["ready", "blocked"]), summary: string(v.summary, "summary"),
    evidence: strings(v.evidence, "evidence"), question: string(v.question, "question", false),
    checks: v.checks.map((raw) => { const c = object(raw); return { command: string(c.command, "command"),
      outcome: oneOf(c.outcome, ["passed", "failed", "skipped"]), detail: string(c.detail, "detail") }; }) };
  if (result.status === "blocked" && !result.question.trim()) throw new Error("Blocked work requires a concrete question");
  if (result.status === "ready" && result.question.trim()) throw new Error("Ready work cannot have an unresolved user question");
  return result;
}
export const planShape = '{status:"ready"|"blocked",summary:string,plan:string,evidence:string[],question:string}';
export const reviewShape = '{status:"pass"|"fix"|"blocked",summary:string,findings:string[],evidence:string[],question:string}';
export const workShape = '{status:"ready"|"blocked",summary:string,evidence:string[],question:string,checks:{command:string,outcome:"passed"|"failed"|"skipped",detail:string}[]}';
export const safety = `Identify the repository from the active session and task/context; read and obey its AGENTS.md before work. If ambiguous, stop with a concrete question. Preserve unrelated changes. Follow repository jj conventions: create a new change before edits if @ contains prior work; never change bookmarks or push/publish/destructively operate unless the user expressly authorizes it. Inspect uncertain effects before repeating operations. Do not create tracking folders or document files by default; workflow outputs persist the work. Save a plan only when the user explicitly asks. Do not invent test success or treat skipped checks as passed. Real uncertainty needing a user decision means blocked with a concrete question, not polling or external blocker registers.`;
export const practical = `Produce usable plan text with evidence, ordered small implementation steps, and project-native test/acceptance criteria. Avoid tickets, RFCs, stakeholder process and approval bureaucracy. Resolve technical questions from repository evidence; stop for genuine user decisions.`;
export function prompt(c: Context, instruction: string): string {
  return `${safety}\n${instruction}\nInput: ${JSON.stringify(c.input)}\nPrior findings, plans, checks and feedback (retain and address them): ${JSON.stringify(c.outputs)}`;
}
export function assess(c: Context, review: Review, extra?: unknown): Ledger {
  const previous = c.outputs.assess as Ledger | undefined;
  const history = [...(previous?.history ?? []), { review, ...(extra === undefined ? {} : { work: extra }) }];
  const fingerprint = (r: Review) => JSON.stringify([r.findings, r.evidence]);
  const repeated = (previous?.history ?? []).some((h) => fingerprint((h as { review: Review }).review) === fingerprint(review));
  const blocked = review.status === "blocked";
  const complete = review.status === "pass";
  const exhausted = history.length >= (c.input as Input).maxRounds;
  return { round: history.length, history, route: complete || blocked || exhausted || repeated ? "done" : "again",
    status: complete ? "complete" : blocked ? "blocked" : "incomplete",
    summary: complete || blocked ? review.summary : `${review.summary} ${repeated ? "Unchanged findings/evidence repeated; stopped." : exhausted ? "Review attempt budget exhausted." : "Fix and re-review required."}` };
}
