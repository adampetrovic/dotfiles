// Run: node tests/software-design.test.mjs
// Structural checks only; model-based smoke results are recorded in the skill's evaluation.md.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = path.join(root, "dot_pi/agent/skills/software-design");
const skill = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");

const wordCount = text => text.trim().split(/\s+/).filter(Boolean).length;
const source = name => path.join(root, "dot_pi/agent/agents", `${name}.md.tmpl`);
const profiles = [
  { profile: "personal", work: false, personal: true },
  { profile: "work", work: true, personal: false },
];
const agents = {
  Implement: {
    personal: ["openai-codex/gpt-6.1-sol", "append", "Do not redesign, widen scope"],
    work: ["anthropic/claude-sonnet-5-5", "append", "Do not redesign, widen scope"],
  },
  Plan: {
    personal: ["openai-codex/gpt-6-astra", "replace", "READ-ONLY MODE"],
    work: ["anthropic/claude-opus-5-5", "replace", "READ-ONLY MODE"],
  },
  Review: {
    personal: ["openai-codex/gpt-6-astra", "replace", "READ-ONLY MODE"],
    work: ["anthropic/claude-opus-5-5", "replace", "READ-ONLY MODE"],
  },
  Audit: {
    personal: ["openai-codex/gpt-6-astra", "replace", "READ-ONLY MODE"],
    work: ["anthropic/claude-opus-5-5", "replace", "READ-ONLY MODE"],
  },
};
const turnLimits = { Implement: 50, Plan: 30, Review: 25, Audit: 40 };
const roleGuidance = {
  Implement: "## Implementation design checks",
  Plan: "For consequential decisions, identify the controlling invariants",
  Review: "Trace the intended behaviour delta",
  Audit: "Report at most 7 findings",
};
const topics = ["foundations.md", "safe-change.md", "architecture.md", "modelling.md", "production.md"];
const references = [...topics, "sources.json", "evaluation.md", "synthesis.md"];

const rubric = readFileSync(path.join(root, ".chezmoitemplates/software-design.md"), "utf8");
assert.ok(wordCount(rubric) <= 900, "Software design rubric must be at most 900 words");
assert.ok(rubric.includes("## Software design rubric"));

assert.match(skill, /^---\n([\s\S]*?)\n---/);
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)[1];
assert.match(frontmatter, /^name:\s*software-design\s*$/m);
const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
assert.ok(description && description.length <= 1024 && !description.includes("\n"));
assert.doesNotMatch(skill, /disable-model-invocation:\s*true/);
for (const filename of references) {
  assert.ok(existsSync(path.join(skillDir, filename)), `Missing ${filename}`);
}
for (const filename of topics) assert.ok(skill.includes(filename), `SKILL.md must mention ${filename}`);

const sources = JSON.parse(readFileSync(path.join(skillDir, "sources.json"), "utf8"));
assert.match(sources.archiveSha256, /^[a-f0-9]{64}$/i);
assert.equal(sources.books.length, 14);
let totalChunks = 0, totalWords = 0, totalSpineItems = 0;
const ids = new Set();
for (const [index, book] of sources.books.entries()) {
  assert.match(book.id, /^\d{2}$/);
  assert.equal(book.id, String(index + 1).padStart(2, "0"));
  assert.ok(!ids.has(book.id));
  ids.add(book.id);
  assert.equal(typeof book.file, "string");
  assert.equal(typeof book.title, "string");
  assert.match(book.sha256, /^[a-f0-9]{64}$/i);
  for (const field of ["words", "spineItems", "chunks", "processedChunks"]) {
    assert.ok(Number.isInteger(book[field]) && book[field] > 0, `${book.id}: invalid ${field}`);
  }
  assert.equal(book.processedChunks, book.chunks);
  totalChunks += book.chunks;
  totalWords += book.words;
  totalSpineItems += book.spineItems;
}
assert.equal(totalChunks, 86);
assert.equal(totalWords, 1512529);
assert.equal(totalSpineItems, 786);

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else assert.ok(!/\.(epub|zip|txt)$/i.test(entry.name), `Unexpected archive/text file: ${file}`);
  }
}
walk(skillDir);

for (const profile of profiles) {
  const data = JSON.stringify(profile);
  for (const [name, variants] of Object.entries(agents)) {
    const rendered = execFileSync("chezmoi", [
      "execute-template", "--config", "/dev/null", "--config-format", "toml",
      "--source", root, "--override-data", data, "--file", source(name),
    ], { encoding: "utf8", timeout: 20000 });
    const fullRubric = name === "Plan" || name === "Audit";
    assert.equal((rendered.match(/^## Software design rubric\s*$/gm) ?? []).length, fullRubric ? 1 : 0, `${name}: role-specific full rubric placement`);
    assert.doesNotMatch(rendered, /^(?:<<<<<<<|=======|>>>>>>>) /m, `${name}: conflict markers`);
    assert.ok(!rendered.includes("{{") && !rendered.includes("}}"), `${name}: unresolved template delimiters`);
    assert.ok(rendered.includes(`name: ${name}`));
    const [model, promptMode, guidance] = variants[profile.profile];
    assert.ok(rendered.includes(model), `${name}: expected model ${model}`);
    assert.ok(rendered.includes(`prompt_mode: ${promptMode}`), `${name}: expected prompt mode`);
    assert.ok(rendered.includes("~/.pi/agent/skills/software-design/SKILL.md"));
    assert.ok(rendered.includes(guidance));
    assert.ok(rendered.includes(roleGuidance[name]), `${name}: role-specific design guidance missing`);
    assert.ok(rendered.includes(`max_turns: ${turnLimits[name]}\n`));
    assert.match(rendered, /^allowed_subagents: Explore$/m);
    if (name !== "Implement") assert.match(rendered, /^tools: read, bash, grep, find, ls$/m);
    if (name === "Implement") {
      assert.ok(rendered.includes("Code against any interface sketch in the brief"));
      assert.equal((rendered.match(/^## Code-level design rubric$/gm) ?? []).length, 1);
      assert.equal((rendered.match(/^## Implementation design checks$/gm) ?? []).length, 1);
    }
    if (name === "Plan") {
      for (const label of ["### Design", "**Chosen**", "**Rejected**", "**Interfaces**"]) assert.ok(rendered.includes(label));
    }
    if (name === "Review") {
      assert.ok(rendered.includes("Report at most 3 design findings"));
      assert.ok(rendered.includes("existing total cap of 3"));
      assert.equal((rendered.match(/^### Design red flags$/gm) ?? []).length, 1);
      assert.ok(rendered.includes("## Handoff to the parent (required)"));
      for (const field of ["filePath", "lineStart", "severity", "annotations"]) assert.ok(rendered.includes(`"${field}"`));
    }
  }
  const ignored = execFileSync("chezmoi", [
    "execute-template", "--config", "/dev/null", "--config-format", "toml",
    "--source", root, "--override-data", data, "--file", path.join(root, ".chezmoiignore.tmpl"),
  ], { encoding: "utf8", timeout: 20000 });
  const lines = ignored.split(/\r?\n/);
  assert.ok(lines.includes("tests/software-design.test.mjs"));
  assert.ok(!lines.includes(".pi/agent/skills/software-design"));
}
console.log("PASS: structural and profile checks; behavioral evaluation is not performed");
