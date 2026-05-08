#!/usr/bin/env node
globalThis.navigator = { platform: 'darwin' };

const api = require('@actual-app/api');
const { q, runQuery } = require('@actual-app/api');

// ── Config from environment ──
const SERVER_URL = process.env.ACTUAL_SERVER_URL;
const PASSWORD = process.env.ACTUAL_PASSWORD;
const SYNC_ID = process.env.ACTUAL_SYNC_ID;
const ENCRYPTION_KEY = process.env.ACTUAL_ENCRYPTION_KEY;
const DATA_DIR = process.env.ACTUAL_DATA_DIR || '/tmp/actual-budget-skill-cache';

function die(msg) { console.error(`❌ ${msg}`); process.exit(1); }

// Suppress noisy library logging (Breadcrumb, Syncing, etc.)
const _origLog = console.log;
let _suppressLog = false;
console.log = (...args) => { if (!_suppressLog) _origLog(...args); };

function requireEnv() {
  if (!SERVER_URL) die('ACTUAL_SERVER_URL not set');
  if (!PASSWORD) die('ACTUAL_PASSWORD not set');
  if (!SYNC_ID) die('ACTUAL_SYNC_ID not set');
}

async function connect() {
  requireEnv();
  _suppressLog = true;
  await api.init({ dataDir: DATA_DIR, serverURL: SERVER_URL, password: PASSWORD });
  const dlOpts = ENCRYPTION_KEY ? { password: ENCRYPTION_KEY } : undefined;
  await api.downloadBudget(SYNC_ID, dlOpts);
  _suppressLog = false;
}

async function disconnect() {
  _suppressLog = true;
  await api.shutdown();
  _suppressLog = false;
}

// ── Helpers ──
function jsonOut(data) { console.log(JSON.stringify(data, null, 2)); }
function centsToStr(cents) { return (cents / 100).toFixed(2); }

// ── Commands ──
const commands = {};

// -- Accounts --
commands['accounts'] = async () => {
  const accounts = await api.getAccounts();
  const results = [];
  for (const a of accounts) {
    const bal = await api.getAccountBalance(a.id);
    results.push({ id: a.id, name: a.name, type: a.type, offbudget: a.offbudget || false, closed: a.closed || false, balance: centsToStr(bal) });
  }
  jsonOut(results);
};

// -- Categories --
commands['categories'] = async () => {
  const groups = await api.getCategoryGroups();
  const cats = await api.getCategories();
  const result = groups.map(g => ({
    id: g.id, name: g.name,
    categories: cats.filter(c => c.group_id === g.id).map(c => ({ id: c.id, name: c.name })),
  }));
  jsonOut(result);
};

commands['create-category'] = async (args) => {
  const [name, groupName] = args;
  if (!name || !groupName) die('Usage: create-category <name> <group-name>');
  const groups = await api.getCategoryGroups();
  const group = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
  if (!group) die(`Category group "${groupName}" not found. Available: ${groups.map(g => g.name).join(', ')}`);
  const cats = await api.getCategories();
  const existing = cats.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) die(`Category "${name}" already exists (id: ${existing.id})`);
  const id = await api.createCategory({ name, group_id: group.id });
  jsonOut({ id, name, group: groupName });
};

commands['delete-category'] = async (args) => {
  const [name] = args;
  if (!name) die('Usage: delete-category <name>');
  const cats = await api.getCategories();
  const cat = cats.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!cat) die(`Category "${name}" not found`);
  await api.deleteCategory(cat.id);
  jsonOut({ deleted: cat.id, name: cat.name });
};

// -- Budget --
commands['budget'] = async (args) => {
  const month = args[0];
  if (!month) die('Usage: budget <YYYY-MM>');
  const data = await api.getBudgetMonth(month);
  const result = [];
  for (const g of data.categoryGroups) {
    for (const c of g.categories) {
      result.push({
        group: g.name, category: c.name,
        budgeted: centsToStr(c.budgeted || 0), spent: centsToStr(c.spent || 0), balance: centsToStr(c.balance || 0),
      });
    }
  }
  jsonOut(result);
};

commands['set-budget'] = async (args) => {
  const [month, catName, amountStr] = args;
  if (!month || !catName || !amountStr) die('Usage: set-budget <YYYY-MM> <category-name> <amount-dollars>');
  const cats = await api.getCategories();
  const cat = cats.find(c => c.name.toLowerCase() === catName.toLowerCase());
  if (!cat) die(`Category "${catName}" not found`);
  const amount = api.utils.amountToInteger(parseFloat(amountStr));
  await api.setBudgetAmount(month, cat.id, amount);
  jsonOut({ month, category: cat.name, budgeted: amountStr });
};

// -- Transactions --
commands['transactions'] = async (args) => {
  const flags = parseFlags(args);
  const accountName = flags.account;
  const since = flags.since;
  const until = flags.until;
  if (!accountName) die('Usage: transactions --account <name> [--since YYYY-MM-DD] [--until YYYY-MM-DD]');

  const accounts = await api.getAccounts();
  const account = accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase());
  if (!account) die(`Account "${accountName}" not found. Available: ${accounts.map(a => a.name).join(', ')}`);

  const txns = await api.getTransactions(account.id, since || '1970-01-01', until || '2099-12-31');
  const cats = await api.getCategories();
  const payees = await api.getPayees();
  const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
  const payeeMap = Object.fromEntries(payees.map(p => [p.id, p.name]));

  const result = txns.map(t => ({
    id: t.id, date: t.date, amount: centsToStr(t.amount),
    payee: payeeMap[t.payee] || t.payee, category: catMap[t.category] || t.category,
    notes: t.notes || '', cleared: t.cleared, imported_id: t.imported_id || null,
  }));
  jsonOut(result);
};

commands['import-transactions'] = async (args) => {
  const flags = parseFlags(args);
  const accountName = flags.account;
  if (!accountName) die('Usage: import-transactions --account <name> (reads JSON array from stdin)');

  const accounts = await api.getAccounts();
  const account = accounts.find(a => a.name.toLowerCase() === accountName.toLowerCase());
  if (!account) die(`Account "${accountName}" not found`);

  const cats = await api.getCategories();
  const catMap = Object.fromEntries(cats.map(c => [c.name.toLowerCase(), c.id]));

  const input = await readStdin();
  let txns;
  try { txns = JSON.parse(input); } catch (e) { die('Invalid JSON on stdin'); }

  const mapped = txns.map(t => {
    const out = { date: t.date, amount: t.amount, payee_name: t.payee_name || t.payee, notes: t.notes || '' };
    if (t.imported_id) out.imported_id = t.imported_id;
    if (t.cleared !== undefined) out.cleared = t.cleared;
    if (t.category) {
      const catId = catMap[t.category.toLowerCase()];
      if (catId) out.category = catId;
      else console.error(`⚠️  Category "${t.category}" not found, skipping category for this txn`);
    }
    return out;
  });

  const result = await api.importTransactions(account.id, mapped);
  jsonOut({ added: result.added?.length || 0, updated: result.updated?.length || 0 });
};

commands['update-transaction'] = async (args) => {
  const [id, ...rest] = args;
  const flags = parseFlags(rest);
  if (!id) die('Usage: update-transaction <id> [--category <name>] [--notes <text>] [--cleared true|false]');

  const update = {};
  if (flags.category) {
    const cats = await api.getCategories();
    const cat = cats.find(c => c.name.toLowerCase() === flags.category.toLowerCase());
    if (!cat) die(`Category "${flags.category}" not found`);
    update.category = cat.id;
  }
  if (flags.notes !== undefined) update.notes = flags.notes;
  if (flags.cleared !== undefined) update.cleared = flags.cleared === 'true';

  await api.updateTransaction(id, update);
  jsonOut({ updated: id, ...update });
};

// -- Payees --
commands['payees'] = async () => {
  const payees = await api.getPayees();
  jsonOut(payees.filter(p => !p.transfer_acct).map(p => ({ id: p.id, name: p.name })));
};

// -- Rules --
commands['rules'] = async () => {
  const rules = await api.getRules();
  jsonOut(rules);
};

commands['create-rule'] = async (args) => {
  const flags = parseFlags(args);
  const payeeName = flags.payee;
  const catName = flags.category;
  if (!payeeName || !catName) die('Usage: create-rule --payee <name> --category <category-name>');

  const cats = await api.getCategories();
  const cat = cats.find(c => c.name.toLowerCase() === catName.toLowerCase());
  if (!cat) die(`Category "${catName}" not found`);

  await api.createRule({
    stage: null,
    conditionsOp: 'and',
    conditions: [{ field: 'payee', op: 'is', value: payeeName }],
    actions: [{ field: 'category', op: 'set', value: cat.id }],
  });
  jsonOut({ payee: payeeName, category: catName });
};

// -- Query (ActualQL) --
commands['query'] = async (args) => {
  const expr = args.join(' ');
  if (!expr) die('Usage: query <actualql-json>');
  let queryDef;
  try { queryDef = JSON.parse(expr); } catch (e) { die('Invalid JSON query'); }

  // Build query from definition: { table, filter?, select?, groupBy?, orderBy?, limit? }
  let qb = q(queryDef.table || 'transactions');
  if (queryDef.filter) qb = qb.filter(queryDef.filter);
  if (queryDef.select) qb = qb.select(queryDef.select);
  if (queryDef.groupBy) qb = qb.groupBy(queryDef.groupBy);
  if (queryDef.orderBy) qb = qb.orderBy(queryDef.orderBy);
  if (queryDef.limit) qb = qb.limit(queryDef.limit);
  if (queryDef.options) qb = qb.options(queryDef.options);

  const { data } = await runQuery(qb);
  jsonOut(data);
};

// -- Budget months --
commands['months'] = async () => {
  const months = await api.getBudgetMonths();
  jsonOut(months);
};

// ── Flag parser ──
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

// ── Stdin reader ──
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    if (process.stdin.isTTY) resolve('');
  });
}

// ── Main ──
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`Usage: actual <command> [args]

Commands:
  accounts                                       List accounts with balances
  categories                                     List category groups and categories
  create-category <name> <group-name>            Create a category in a group
  delete-category <name>                         Delete a category
  budget <YYYY-MM>                               Show budget for a month
  set-budget <YYYY-MM> <category> <amount>       Set budget amount (dollars)
  months                                         List budget months
  transactions --account <name> [--since] [--until]  List transactions
  import-transactions --account <name>           Import JSON array from stdin
  update-transaction <id> [--category] [--notes] [--cleared]
  payees                                         List payees
  rules                                          List rules
  create-rule --payee <name> --category <name>   Create categorization rule
  query <actualql-json>                          Run ActualQL query

Environment variables:
  ACTUAL_SERVER_URL        Server URL (required)
  ACTUAL_PASSWORD          Server password (required)
  ACTUAL_SYNC_ID           Budget sync ID (required)
  ACTUAL_ENCRYPTION_KEY    E2E encryption password (if enabled)
  ACTUAL_DATA_DIR          Local cache dir (default: /tmp/actual-budget-skill-cache)`);
    process.exit(0);
  }

  if (!commands[cmd]) die(`Unknown command: ${cmd}. Run with --help for usage.`);

  await connect();
  try {
    await commands[cmd](args);
  } finally {
    await disconnect();
  }
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
