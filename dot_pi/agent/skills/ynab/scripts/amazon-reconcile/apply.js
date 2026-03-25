#!/usr/bin/env node
/**
 * Apply YNAB updates from a reconciliation plan.
 *
 * Reads a JSON plan from stdin with the structure:
 *   [{ ynab_id, memo, category_id }, ...]
 *
 * Usage:
 *   cat plan.json | node apply.js [--dry-run]
 *   echo '[{"ynab_id":"abc","memo":"test","category_id":"xyz"}]' | node apply.js
 */

import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const YNAB_CLI = join(__dirname, "..", "ynab");

const dryRun = process.argv.includes("--dry-run");
const _tmpDir = mkdtempSync(join(tmpdir(), "amazon-reconcile-apply-"));

function log(...args) {
  console.error("[amazon-reconcile:apply]", ...args);
}

function ynabUpdate(id, categoryId, memo) {
  const args = [`transactions update ${id}`];
  if (categoryId) args.push(`--category-id ${categoryId}`);
  if (memo) args.push(`--memo "${memo.replace(/"/g, '\\"')}"`);
  args.push("--compact");

  const tmpFile = join(_tmpDir, `ynab-${Date.now()}.json`);
  try {
    const cmd = `bash "${YNAB_CLI}" ${args.join(" ")} 2>/dev/null > "${tmpFile}"`;
    execSync(cmd, { timeout: 15000, env: { ...process.env } });
    const raw = readFileSync(tmpFile, "utf-8").trim();
    const jsonStart = raw.search(/[\[{]/);
    if (jsonStart < 0) throw new Error(`No JSON in ynab output: ${raw.slice(0, 200)}`);
    return JSON.parse(raw.slice(jsonStart));
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function main() {
  // Read plan from stdin
  const input = readFileSync("/dev/stdin", "utf-8").trim();
  if (!input) {
    console.error("Error: no input. Pipe a JSON plan to stdin.");
    process.exit(1);
  }

  let plan;
  try {
    plan = JSON.parse(input);
  } catch {
    console.error("Error: invalid JSON input.");
    process.exit(1);
  }

  if (!Array.isArray(plan) || plan.length === 0) {
    console.error("Error: plan must be a non-empty JSON array.");
    process.exit(1);
  }

  log(`${dryRun ? "[DRY RUN] " : ""}Applying ${plan.length} updates...`);

  const results = { success: [], failed: [] };

  for (const item of plan) {
    const { ynab_id, memo, category_id } = item;
    if (!ynab_id) {
      log(`  Skipping entry with no ynab_id`);
      results.failed.push({ ...item, error: "missing ynab_id" });
      continue;
    }

    if (dryRun) {
      log(`  [DRY RUN] ${ynab_id}: category=${category_id}, memo="${memo}"`);
      results.success.push(item);
      continue;
    }

    try {
      const updated = ynabUpdate(ynab_id, category_id, memo);
      log(`  ✓ ${updated.date} $${Math.abs(updated.amount).toFixed(2)} → ${updated.category_name} | ${updated.memo}`);
      results.success.push({
        ynab_id,
        date: updated.date,
        amount: updated.amount,
        category: updated.category_name,
        memo: updated.memo,
      });
    } catch (e) {
      log(`  ✗ ${ynab_id}: ${e.message}`);
      results.failed.push({ ...item, error: e.message });
    }
  }

  log(`Done. ${results.success.length} succeeded, ${results.failed.length} failed.`);
  console.log(JSON.stringify(results, null, 2));
}

main();
