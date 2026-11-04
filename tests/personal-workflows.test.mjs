// Run: node tests/personal-workflows.test.mjs [installed pi-workflows package]
// Scripted graph tests use the installed loader and never call a model or edit a project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, cp, mkdir, appendFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.resolve(process.argv[2] ?? path.join(homedir(), ".pi/agent/npm/node_modules/@osolmaz/pi-workflows"));
const api = await import(pathToFileURL(path.join(packageDir, "dist/workflows/index.js")));
const source = path.join(root, "dot_pi/agent/workflows");
const names = ["explore-loop", "delivery-plan", "plan-implement-loop"];
const workflows = Object.fromEntries(await Promise.all(names.map(async name => {
  const workflow = await api.loadWorkflowFile(path.join(source, `${name}.workflow.ts`));
  api.validateWorkflowDefinition(workflow);
  assert.equal(workflow.name, name);
  assert.ok(Number.isInteger(workflow.maxSteps) && workflow.maxSteps > 0);
  for (const node of Object.values(workflow.nodes)) {
    if (node.nodeType === "agent") {
      assert.ok(node.timeoutMs > 0, "Agent needs explicit timeout");
      assert.equal(typeof node.validate, "function", "Routed model output needs validation");
      await assert.rejects(async () => node.validate({}, {}));
    }
  }
  for (const input of [null, {}, { task: " " }, { task: 42 }, { task: "Test task", context: 1 }]) {
    assert.throws(() => workflow.input(input));
  }
  for (const maxRounds of [0, 9, 1.5, "3"]) {
    assert.throws(() => workflow.input({ task: "Test task", maxRounds }));
  }
  for (const maxRounds of [1, 3, 8]) {
    assert.equal(workflow.input({ task: "Test task", maxRounds }).maxRounds, maxRounds);
  }
  return [name, workflow];
})));

// Discovery is checked against a temporary deployed layout, without touching ~/.pi.
const home = await mkdtemp(path.join(tmpdir(), "personal-workflows-"));
try {
  const target = path.join(home, ".pi/agent/workflows");
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
  const discovered = await api.discoverWorkflows({ cwd: home, homeDir: home });
  for (const name of names) {
    assert.ok(discovered.some(item => item.name === name && item.source === "global"));
    await api.resolveWorkflowRef(name, { cwd: home, homeDir: home });
  }
  await appendFile(path.join(target, "lib/personal.ts"), "\n// Simulate a helper-only update\n");
  for (const name of names) {
    await assert.rejects(() => api.loadWorkflowFile(path.join(target, `${name}.workflow.ts`)), /helper changed/);
  }
} finally {
  await rm(home, { recursive: true, force: true });
}

async function walk(name, scripts, input = {}) {
  const workflow = workflows[name];
  const outputs = {};
  const results = {};
  const steps = [];
  const counts = {};
  const prompts = [];
  const state = { steps, outputs, results };
  const context = {
    input: workflow.input({ task: "Test a personal project", ...input }),
    outputs, results, state, signal: new AbortController().signal,
  };
  let id = workflow.startAt;
  let last;
  while (id !== null) {
    assert.ok(steps.length < workflow.maxSteps, `${name} exhausted maxSteps`);
    const node = workflow.nodes[id];
    assert.ok(node, `Missing node ${id}`);
    counts[id] = (counts[id] ?? 0) + 1;
    let output;
    if (node.nodeType === "compute") {
      output = await node.run(context);
    } else {
      if (node.nodeType === "agent") {
        const prompt = await node.prompt(context);
        assert.ok(typeof prompt === "string" && prompt.length > 0);
        assert.ok(!prompt.includes("[object Object]"));
        prompts.push({ id, prompt });
      }
      const script = scripts[id];
      assert.ok(script, `No scripted answer for ${name}/${id}`);
      output = structuredClone(typeof script === "function" ? script(counts[id], context) : script);
      if (node.nodeType === "agent" && node.validate) output = await node.validate(output, context);
      if (node.humanDecision) {
        assert.equal(node.humanDecision.onTimeout, undefined);
        const request = api.createHumanDecisionRequest({
          runId: "test", workflowName: name, nodeId: id, attemptId: `attempt-${steps.length}`,
          contract: node.humanDecision, prompt: await node.humanDecision.request(context),
        });
        output = api.validateHumanDecisionResponse(request, output);
      }
    }
    last = output;
    outputs[id] = output;
    results[id] = { nodeId: id, nodeType: node.nodeType, outcome: "ok", output };
    steps.push({ nodeId: id, nodeType: node.nodeType, outcome: "ok", output });
    id = api.resolveNext(workflow.edges, id, output, results[id]);
  }
  return { last, outputs, counts, prompts, steps };
}

for (const work of [false, true]) {
  const ignored = execFileSync("chezmoi", ["execute-template", "--config", "/dev/null", "--config-format", "toml", "--source", root, "--override-data", JSON.stringify({ profile: work ? "work" : "personal", work, personal: !work }), "--file", path.join(root, ".chezmoiignore.tmpl")], { encoding: "utf8", timeout: 10000 });
  // On work the whole directory is ignored: it belongs to the work-scripts package there.
  assert.equal(ignored.split("\n").includes(".pi/agent/workflows"), work);
  assert.ok(ignored.includes("tests/personal-workflows.test.mjs"));
}
const finding = (status = "enough", round = 1) => ({
  status, summary: `Investigation ${round}`, recommendation: "Reuse the existing helper",
  evidence: [`src/helper.ts:${round}`], uncertainty: [], nextAction: "Plan the change",
  questions: status === "enough" ? [] : ["Which behavior is wanted?"],
});
const plan = (round = 1) => ({ status: "ready", summary: `Plan ${round}`, plan: `Change helper ${round}; run tests`, evidence: ["src/helper.ts:1"], question: "" });
const review = (status = "pass", round = 1) => ({ status, summary: `Review ${round}`, findings: status === "fix" ? [`Fix edge case ${round}`] : [], evidence: [`tests/helper.test.ts:${round}`], question: status === "blocked" ? "Which behavior is wanted?" : "" });

assert.equal((await walk("explore-loop", { investigate: finding() })).last.status, "complete");
assert.equal((await walk("explore-loop", { investigate: finding("blocked") })).last.status, "blocked");
const explored = await walk("explore-loop", { investigate: n => finding(n === 1 ? "more" : "enough", n) });
assert.equal(explored.counts.investigate, 2);
assert.ok(explored.prompts[1].prompt.includes("Investigation 1"));
assert.equal((await walk("explore-loop", { investigate: finding("more") }, { maxRounds: 8 })).counts.investigate, 2);
for (const maxRounds of [1, 3, 8]) {
  const run = await walk("explore-loop", { investigate: n => finding("more", n) }, { maxRounds });
  assert.equal(run.last.status, "incomplete");
  assert.equal(run.counts.investigate, maxRounds);
}
assert.equal((await walk("delivery-plan", { draft: plan(), review: review() })).last.status, "complete");
assert.equal((await walk("delivery-plan", { draft: plan(), review: review("blocked") })).last.status, "blocked");
assert.equal((await walk("delivery-plan", { draft: { ...plan(), status: "blocked", question: "What scope?" }, review: review() })).last.status, "blocked");
const revised = await walk("delivery-plan", { draft: n => plan(n), review: n => review(n === 1 ? "fix" : "pass", n) });
assert.equal(revised.counts.draft, 2);
assert.ok(revised.prompts.find(p => p.id === "draft" && p.prompt.includes("Fix edge case 1")));
assert.equal((await walk("delivery-plan", { draft: n => plan(n), review: review("fix") }, { maxRounds: 8 })).counts.draft, 2);
for (const maxRounds of [1, 3, 8]) {
  const run = await walk("delivery-plan", { draft: n => plan(n), review: n => review("fix", n) }, { maxRounds });
  assert.equal(run.last.status, "incomplete");
  assert.equal(run.counts.draft, maxRounds);
}
const work = (outcome = "passed") => ({ status: "ready", summary: "Implemented helper", evidence: ["src/helper.ts:1"], question: "", checks: [{ command: "npm test", outcome, detail: outcome === "passed" ? "12 tests passed" : "Test evidence incomplete" }] });
const implementation = { plan: plan(), approval: { choice: "approve" }, implement: work(), review: review() };
const implemented = await walk("plan-implement-loop", implementation);
assert.equal(implemented.last.status, "complete");
assert.ok(implemented.steps.findIndex(s => s.nodeId === "approval") < implemented.steps.findIndex(s => s.nodeId === "implement"));
assert.equal((await walk("plan-implement-loop", { plan: plan(), approval: { choice: "stop" } })).last.status, "stopped");
assert.equal((await walk("plan-implement-loop", { plan: { ...plan(), status: "blocked", question: "What scope?" } })).last.status, "blocked");
const replanned = await walk("plan-implement-loop", { ...implementation, plan: n => plan(n), approval: n => n === 1 ? { choice: "revise", input: { feedback: "Use the existing helper" } } : { choice: "approve" } });
assert.equal(replanned.counts.plan, 2);
assert.ok(replanned.prompts.find(p => p.id === "plan" && p.prompt.includes("Use the existing helper")));
assert.equal((await walk("plan-implement-loop", { plan: plan(), approval: { choice: "revise", input: { feedback: "Change it" } } })).last.status, "incomplete");
await assert.rejects(() => walk("plan-implement-loop", { plan: plan(), approval: { choice: "revise", input: { feedback: "" } } }));
for (const maxRounds of [1, 3, 8]) {
  const exhaustedPlan = await walk("plan-implement-loop", { plan: n => plan(n), approval: { choice: "revise", input: { feedback: "Change it" } } }, { maxRounds });
  assert.equal(exhaustedPlan.last.status, "incomplete");
  assert.equal(exhaustedPlan.counts.plan, maxRounds);
  assert.equal(exhaustedPlan.counts.implement, undefined);
  const exhaustedWork = await walk("plan-implement-loop", { ...implementation, review: n => review("fix", n) }, { maxRounds });
  assert.equal(exhaustedWork.last.status, "incomplete");
  assert.equal(exhaustedWork.counts.implement, maxRounds);
}
assert.equal((await walk("plan-implement-loop", { ...implementation, review: review("fix") }, { maxRounds: 8 })).counts.implement, 2);
for (const outcome of ["failed", "skipped"]) {
  assert.equal((await walk("plan-implement-loop", { ...implementation, implement: work(outcome) }, { maxRounds: 1 })).last.status, "incomplete");
}
assert.equal((await walk("plan-implement-loop", { ...implementation, implement: { ...work(), status: "blocked", question: "May the scope change?" } })).last.status, "blocked");
assert.equal((await walk("plan-implement-loop", { ...implementation, review: review("blocked") })).last.status, "blocked");
const fixed = await walk("plan-implement-loop", { ...implementation, review: n => review(n === 1 ? "fix" : "pass", n) });
assert.equal(fixed.last.status, "complete");
assert.equal(fixed.counts.implement, 2);
assert.ok(fixed.prompts.find(p => p.id === "implement" && p.prompt.includes("Fix edge case 1")));

// Exercise persistence and runtime boundaries with a scripted executor, isolated from live Pi state.
const runtimeDir = await mkdtemp(path.join(tmpdir(), "personal-workflows-runtime-"));
try {
  let serial = 0;
  async function execute(workflow, script) {
    const visited = [];
    const engine = new api.WorkflowEngine({
      databasePath: path.join(runtimeDir, `${serial++}.sqlite`),
      executor: { async runAgentStep(request) {
        visited.push(request.contract.nodeId);
        const accepted = await request.accept(script[request.contract.nodeId]);
        assert.equal(accepted.ok, true, accepted.error);
        return { output: accepted.value };
      } },
    });
    const { state } = await engine.run(workflow, { task: "Scripted smoke test", maxRounds: 1 });
    return { state, visited, engine };
  }
  assert.equal((await execute(workflows["explore-loop"], { investigate: finding() })).state.status, "completed");
  assert.equal((await execute(workflows["delivery-plan"], { draft: plan(), review: review() })).state.status, "completed");
  const parked = await execute(workflows["plan-implement-loop"], { plan: plan() });
  assert.equal(parked.state.status, "waiting");
  assert.deepEqual(parked.visited, ["plan"], "Protected approval must park before implementation");
  await assert.rejects(() => parked.engine.resumeRun(workflows["plan-implement-loop"], parked.state.runId), /status waiting/);
  assert.deepEqual(parked.visited, ["plan"], "Resume must retain the accepted plan and cannot bypass approval");

  const original = workflows["explore-loop"];
  const timeoutWorkflow = { ...original, nodes: { ...original.nodes, investigate: { ...original.nodes.investigate, timeoutMs: 5 } } };
  for (const mode of ["failed", "timed_out", "cancelled"]) {
    let engine;
    engine = new api.WorkflowEngine({
      databasePath: path.join(runtimeDir, `${serial++}.sqlite`),
      executor: { async runAgentStep(_request, signal) {
        if (mode === "failed") throw new Error("Scripted executor failure");
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          if (mode === "cancelled") queueMicrotask(() => engine.cancel());
        });
      } },
    });
    const { state } = await engine.run(mode === "timed_out" ? timeoutWorkflow : original, { task: "Test interruption" });
    assert.equal(state.status, mode);
  }
} finally {
  await rm(runtimeDir, { recursive: true, force: true });
}
console.log("PASS: loading, inputs, discovery, profiles, approval, feedback, budgets, verification, persistence, failures, timeout and cancellation");
