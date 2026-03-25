#!/usr/bin/env node
/**
 * Amazon AU → YNAB reconciler
 *
 * Scrapes Amazon AU transactions + order history via CDP,
 * matches them to unapproved YNAB transactions by date + amount,
 * and outputs a JSON manifest the agent can review / apply.
 *
 * Prerequisites:
 *   Chrome running with --remote-debugging-port=9222 (use web-browser start.js --profile)
 *   Logged into amazon.com.au in that Chrome profile
 *
 * Usage:
 *   node scrape.js --since 2026-02-01 [--until 2026-03-16] [--account <ynab-account-id>]
 *
 * Output (stdout): JSON array of matched transactions:
 *   [{ ynab_id, date, amount, order_id, items: [name, ...], current_category, memo }]
 */

import { connect } from "./cdp.js";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const YNAB_CLI = join(__dirname, "..", "ynab");

// ── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { since: null, until: null, account: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since" && args[i + 1]) opts.since = args[++i];
    else if (args[i] === "--until" && args[i + 1]) opts.until = args[++i];
    else if (args[i] === "--account" && args[i + 1]) opts.account = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: node scrape.js --since YYYY-MM-DD [--until YYYY-MM-DD] [--account <ynab-account-id>]

Options:
  --since    Start date (required, YYYY-MM-DD)
  --until    End date   (optional, defaults to today)
  --account  YNAB account ID (optional, auto-detects if only one card account has Amazon transactions)`);
      process.exit(0);
    }
  }

  if (!opts.since) {
    console.error("Error: --since YYYY-MM-DD is required");
    process.exit(1);
  }
  if (!opts.until) {
    opts.until = new Date().toISOString().slice(0, 10);
  }
  return opts;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(...args) {
  console.error("[amazon-reconcile]", ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const _tmpDir = mkdtempSync(join(tmpdir(), "amazon-reconcile-"));

function ynab(...args) {
  const tmpFile = join(_tmpDir, `ynab-${Date.now()}.json`);
  try {
    execSync(`bash "${YNAB_CLI}" ${args.join(" ")} 2>/dev/null > "${tmpFile}"`, {
      timeout: 30000,
      env: { ...process.env },
    });
    const raw = readFileSync(tmpFile, "utf-8").trim();
    const jsonStart = raw.search(/[\[{]/);
    if (jsonStart < 0) throw new Error(`No JSON in ynab output: ${raw.slice(0, 200)}`);
    return JSON.parse(raw.slice(jsonStart));
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function evaluate(cdp, sessionId, code, timeout = 30000) {
  const wrapped = `(async () => { ${code} })()`;
  return cdp.evaluate(sessionId, wrapped, timeout);
}

async function navigateAndWait(cdp, sessionId, url, waitMs = 3000) {
  await cdp.navigate(sessionId, url);
  // Wait for DOMContentLoaded plus extra settle time
  await sleep(waitMs);
  // Extra wait for dynamic content
  await evaluate(cdp, sessionId, `
    return new Promise(function(resolve) {
      if (document.readyState === "complete") return resolve(true);
      window.addEventListener("load", function() { resolve(true); });
      setTimeout(function() { resolve(true); }, 5000);
    });
  `).catch(() => {});
  await sleep(500);
}

// ── Amazon transactions scraping ────────────────────────────────────────────

async function scrapeAmazonTransactions(cdp, sessionId, since, until) {
  log("Navigating to Amazon AU transactions page...");
  await navigateAndWait(cdp, sessionId, "https://www.amazon.com.au/cpe/yourpayments/transactions", 4000);

  const allCharges = [];
  let pageNum = 0;
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  untilDate.setHours(23, 59, 59); // inclusive

  while (true) {
    pageNum++;
    log(`  Scraping transactions page ${pageNum}...`);

    const raw = await evaluate(cdp, sessionId, `
      var box = document.querySelector(".a-box-group.a-spacing-base");
      return box ? box.innerText : "";
    `);

    if (!raw) {
      log("  No transaction box found – stopping.");
      break;
    }

    const parsed = parseTransactionText(raw);
    let foundOlder = false;

    for (const txn of parsed) {
      const d = new Date(txn.date);
      if (d < sinceDate) { foundOlder = true; continue; }
      if (d > untilDate) continue;
      allCharges.push(txn);
    }

    // If the last entry on this page is older than our range, stop
    if (foundOlder) break;

    // Try clicking "Next page"
    const hasNext = await evaluate(cdp, sessionId, `
      var btns = Array.from(document.querySelectorAll("span, input"));
      var next = btns.find(function(el) {
        return (el.getAttribute("name") || "").indexOf("NextPage") > -1;
      });
      if (next) { next.click(); return true; }
      return false;
    `);

    if (!hasNext) {
      log("  No more pages.");
      break;
    }
    await sleep(3000);
  }

  log(`  Found ${allCharges.length} Mastercard charges in date range.`);
  return allCharges;
}

/**
 * Parse the innerText blob from the Amazon transactions box.
 *
 * Format is blocks like:
 *   15 March 2026
 *   Mastercard ****NNNN        (or "Amazon gift card used")
 *   -$25.99
 *   Order #249-6250041-1825439
 *   [optional AmznPrime note]
 *
 * Multiple charges can appear under the same date header.
 */
function parseTransactionText(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  const dateRe = /^(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/;
  const amountRe = /^([+-])?\$?([\d,]+\.\d{2})$/;
  const orderRe = /^Order #([\w-]+)$/;

  let currentDate = null;
  let i = 0;

  while (i < lines.length) {
    const dateMatch = lines[i].match(dateRe);
    if (dateMatch) {
      const months = { January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
        July: "07", August: "08", September: "09", October: "10", November: "11", December: "12" };
      const day = dateMatch[1].padStart(2, "0");
      currentDate = `${dateMatch[3]}-${months[dateMatch[2]]}-${day}`;
      i++;
      continue;
    }

    // Look for a charge block: payment_method, amount, order
    if (lines[i].startsWith("Mastercard")) {
      const amtMatch = lines[i + 1]?.match(amountRe);
      const ordMatch = lines[i + 2]?.match(orderRe);
      if (amtMatch && ordMatch && currentDate) {
        const sign = amtMatch[1] || "-";
        const amount = parseFloat(amtMatch[2].replace(/,/g, ""));
        results.push({
          date: currentDate,
          amount: sign === "+" ? amount : -amount,
          order_id: ordMatch[1],
          is_refund: sign === "+",
        });
        // Check for extra info line (e.g. "AmznPrimeAU Membership")
        i += 3;
        // Skip note lines until next date/mastercard/gift card
        while (i < lines.length && !lines[i].match(dateRe) && !lines[i].startsWith("Mastercard") && !lines[i].startsWith("Amazon gift card")) {
          const extra = lines[i];
          if (extra.startsWith("AmznPrime")) {
            results[results.length - 1].note = extra;
          }
          i++;
        }
        continue;
      }
    }

    // Skip gift card lines and other non-Mastercard entries
    i++;
  }

  return results;
}

// ── Amazon order history scraping ───────────────────────────────────────────

async function scrapeAmazonOrders(cdp, sessionId, orderIds) {
  log("Navigating to Amazon AU order history...");
  await navigateAndWait(cdp, sessionId, "https://www.amazon.com.au/gp/your-account/order-history", 4000);

  const orderMap = {};       // order_id → [product_name, ...]
  const needed = new Set(orderIds);
  let pageNum = 0;

  while (needed.size > 0) {
    pageNum++;
    log(`  Scraping order history page ${pageNum}... (${needed.size} orders still needed)`);

    const pageOrders = await evaluate(cdp, sessionId, `
      return Array.from(document.querySelectorAll("[class*=order-card]")).map(function(card) {
        var spans = Array.from(card.querySelectorAll("span"));
        var texts = spans.map(function(s) { return s.textContent.trim(); }).filter(function(t) { return t.length > 0; });
        var orderMatch = texts.find(function(t) { return /^\\d{3}-\\d{7}-\\d{7}$/.test(t); });
        var links = Array.from(card.querySelectorAll("a"));
        var productLinks = links.filter(function(a) { return a.href && a.href.indexOf("/dp/") > -1; });
        var items = productLinks.map(function(a) { return a.textContent.trim(); }).filter(function(t) { return t.length > 5; });
        return { order: orderMatch || null, items: items };
      });
    `);

    if (!pageOrders || pageOrders.length === 0) break;

    for (const o of pageOrders) {
      if (o.order && needed.has(o.order)) {
        orderMap[o.order] = o.items;
        needed.delete(o.order);
      }
    }

    if (needed.size === 0) break;

    // Check if oldest order on page is older than oldest needed – if so we can stop
    // Try next page
    const hasNext = await evaluate(cdp, sessionId, `
      var links = Array.from(document.querySelectorAll(".a-pagination li a"));
      var next = links.find(function(a) { return a.textContent.trim().indexOf("Next") > -1; });
      if (next) { next.click(); return true; }
      return false;
    `);

    if (!hasNext) {
      log("  No more order pages.");
      break;
    }
    await sleep(3000);
  }

  if (needed.size > 0) {
    log(`  Warning: Could not find product info for orders: ${[...needed].join(", ")}`);
    // For Prime membership orders (D01-*), fill in a default
    for (const oid of needed) {
      if (oid.startsWith("D01-")) {
        orderMap[oid] = ["Amazon Prime Membership"];
      }
    }
  }

  log(`  Resolved product names for ${Object.keys(orderMap).length} orders.`);
  return orderMap;
}

// ── YNAB matching ───────────────────────────────────────────────────────────

function getUnapprovedAmazonTransactions(account, since) {
  log("Fetching unapproved YNAB transactions...");

  const args = ["transactions", "list", "--approved=false", "--compact"];
  if (account) args.push("--account", account);
  args.push("--since", since);

  const txns = ynab(...args);

  // Filter to Amazon payee
  const amazon = txns.filter((t) => {
    const payee = (t.payee_name || "").toLowerCase();
    const importPayee = (t.import_payee_name || "").toLowerCase();
    return payee.includes("amazon") || importPayee.includes("amazon");
  });

  log(`  Found ${amazon.length} unapproved Amazon transactions.`);
  return amazon;
}

function matchTransactions(ynabTxns, amazonCharges, orderMap) {
  log("Matching transactions...");
  const matched = [];
  const unmatched = [];

  // Index amazon charges by "date|amount"
  const chargeIndex = new Map();
  for (const charge of amazonCharges) {
    const key = `${charge.date}|${charge.amount.toFixed(2)}`;
    if (!chargeIndex.has(key)) chargeIndex.set(key, []);
    chargeIndex.get(key).push({ ...charge, used: false });
  }

  for (const txn of ynabTxns) {
    const key = `${txn.date}|${txn.amount.toFixed(2)}`;
    const candidates = chargeIndex.get(key) || [];
    const charge = candidates.find((c) => !c.used);

    if (charge) {
      charge.used = true;
      const items = orderMap[charge.order_id] || [];
      matched.push({
        ynab_id: txn.id,
        date: txn.date,
        amount: txn.amount,
        order_id: charge.order_id,
        items,
        is_refund: charge.is_refund || false,
        note: charge.note || null,
        current_category_id: txn.category_id,
        current_category: txn.category_name,
        current_memo: txn.memo,
      });
    } else {
      unmatched.push({
        ynab_id: txn.id,
        date: txn.date,
        amount: txn.amount,
        current_category: txn.category_name,
      });
    }
  }

  log(`  Matched: ${matched.length}, Unmatched: ${unmatched.length}`);
  return { matched, unmatched };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // 1. Connect to Chrome
  log("Connecting to Chrome...");
  const cdp = await connect(5000);
  const pages = await cdp.getPages();
  const page = pages.at(-1);
  if (!page) {
    console.error("Error: No Chrome tab found. Start Chrome with: web-browser start.js --profile");
    process.exit(1);
  }
  const sessionId = await cdp.attachToPage(page.targetId);

  try {
    // 2. Scrape Amazon transactions
    const charges = await scrapeAmazonTransactions(cdp, sessionId, opts.since, opts.until);

    // Filter out refunds for matching (but keep them in output)
    const debits = charges.filter((c) => !c.is_refund);

    // 3. Collect unique order IDs and scrape product names
    const orderIds = [...new Set(debits.map((c) => c.order_id))];
    const orderMap = await scrapeAmazonOrders(cdp, sessionId, orderIds);

    // 4. Get YNAB unapproved Amazon transactions
    const ynabTxns = getUnapprovedAmazonTransactions(opts.account, opts.since);

    // 5. Match
    const { matched, unmatched } = matchTransactions(ynabTxns, debits, orderMap);

    // 6. Get categories for reference
    log("Fetching YNAB categories...");
    const catGroups = ynab("categories", "list", "--compact");
    const categories = [];
    for (const g of catGroups) {
      for (const c of g.categories || []) {
        if (!c.deleted && !c.hidden) {
          categories.push({ id: c.id, name: c.name, group: g.name });
        }
      }
    }

    // 7. Output
    const output = { matched, unmatched, categories };
    console.log(JSON.stringify(output, null, 2));

  } finally {
    cdp.close();
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
