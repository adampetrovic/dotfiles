---
name: ynab
description: Interact with YNAB (You Need A Budget) via the ynab CLI. List budgets, accounts, categories, transactions, payees, and monthly budgets. Create, update, delete, and search transactions. Set category budgets. Use when the user asks about their budget, spending, account balances, transactions, or any YNAB operation.
---

# YNAB Budget Manager (CLI)

## Quick start

- Get a YNAB Personal Access Token at https://app.ynab.com/settings/developer
- Either store it via `bash ~/.pi/agent/skills/ynab/scripts/ynab auth login` or add `YNAB_API_KEY=<token>` to `~/.pi/agent/skills/ynab/.skills-data/.env`
- Run the CLI (auto-bootstraps on first run):
  - `bash ~/.pi/agent/skills/ynab/scripts/ynab budgets list`
  - `bash ~/.pi/agent/skills/ynab/scripts/ynab accounts list`
  - `bash ~/.pi/agent/skills/ynab/scripts/ynab transactions list --since 2026-03-01`

## Operating rules

- **Read before write.** Always use read-only commands first (`list`, `view`, `search`) to discover IDs and current state before making changes.
- **Confirm writes.** Before any write command (`create`, `update`, `delete`, `budget`), summarize the exact changes and ask the user for confirmation.
- **Resolve names to IDs.** If the user gives a name (account, category, payee), resolve it by listing first. Use `--compact` to keep output short when scanning for IDs.
- **Default budget.** After first listing budgets, set a default with `budgets set-default <id>` so subsequent commands don't need `--budget`.
- **Amounts are in dollars.** All CLI commands use dollars (not YNAB milliunits). `--amount -42.50` means a $42.50 outflow. **Exception:** the `ynab api` raw command uses YNAB milliunits directly (multiply dollars × 1000, e.g. -42.50 → -42500).
- **Dates use YYYY-MM-DD.** All date arguments use ISO format.
- **Batch writes to avoid rate limits.** The YNAB API allows only 200 requests/hour. When creating or updating multiple transactions, always use `transactions import` (stdin JSON array) or `transactions batch-update` instead of individual `create`/`update` calls. One batch call = one request regardless of how many transactions it contains.

## Local data and env

- Config and env stored in `~/.pi/agent/skills/ynab/.skills-data/`
- YNAB API key: either OS keychain (via `ynab auth login`) or `YNAB_API_KEY` in `.skills-data/.env`
- Logs/cache/tmp under `.skills-data/logs`, `.skills-data/cache`, `.skills-data/tmp`

## Commands reference

All commands output JSON. Add `--compact` for single-line output.

### Auth
```bash
ynab auth login          # Store token in OS keychain
ynab auth status         # Check authentication
ynab auth logout         # Remove credentials
```

### Budgets
```bash
ynab budgets list                    # List all budgets
ynab budgets view [id]               # Budget details (uses default)
ynab budgets settings [id]           # Budget settings
ynab budgets set-default <id>        # Set default budget
```

### Accounts
```bash
ynab accounts list                   # List all accounts
ynab accounts view <id>              # Account details
ynab accounts transactions <id>      # Transactions for account
```

### Categories
```bash
ynab categories list                 # List all category groups + categories
ynab categories view <id>            # Category details
ynab categories update <id> [--name <name>] [--note <note>]
ynab categories budget <id> --month <YYYY-MM> --amount <amount>   # Set budgeted amount
ynab categories transactions <id>    # Transactions for category
```

### Transactions
```bash
# List & search
ynab transactions list [--since <YYYY-MM-DD>] [--account <id>] [--category <id>]
ynab transactions list --approved=false --min-amount 100
ynab transactions search --memo "coffee"
ynab transactions search --payee-name "Amazon"
ynab transactions summary [--since <YYYY-MM-DD>]   # Aggregate by payee/category

# CRUD
ynab transactions view <id>
ynab transactions create --account <id> --amount <amount> --date <YYYY-MM-DD> [--payee-name <name>] [--category <id>] [--memo <text>]
ynab transactions update <id> [--amount <amount>] [--date <date>] [--memo <text>] [--category <id>]
ynab transactions delete <id>

# Advanced
ynab transactions split <id> --splits '[{"amount": -50.00, "category_id": "xxx"}]'
ynab transactions import --transactions '[{...}]'
ynab transactions batch-update --transactions '[{...}]'
ynab transactions find-transfers <id>     # Find transfer matches
```

### Payees
```bash
ynab payees list                     # List all payees
ynab payees view <id>                # Payee details
ynab payees update <id> --name <n>   # Rename payee
ynab payees transactions <id>        # Transactions for payee
```

### Months
```bash
ynab months list                     # List all budget months
ynab months view <YYYY-MM>           # View month budget details (category balances)
```

### Scheduled Transactions
```bash
ynab scheduled list                  # List all scheduled transactions
ynab scheduled view <id>             # View scheduled transaction
ynab scheduled delete <id>           # Delete scheduled transaction
```

### Raw API
```bash
ynab api GET /budgets
ynab api POST /budgets/{id}/transactions --data '{"transaction": {...}}'
```

## Amazon Reconciliation Sub-Skill

Automatically matches unapproved Amazon transactions in YNAB with actual purchases scraped from amazon.com.au, so you can set the correct category and memo for each charge.

### Prerequisites

- Chrome running with user profile: `node ~/.pi/agent/skills/web-browser/scripts/start.js --profile`
- Logged into amazon.com.au in that Chrome profile
- YNAB default budget set (run `ynab budgets set-default <id>` first)

### Step 1 — Scrape & Match

```bash
node ~/.pi/agent/skills/ynab/scripts/amazon-reconcile/scrape.js \
  --since 2026-02-01 \
  [--until 2026-03-16] \
  [--account <ynab-account-id>]
```

**Output (stdout):** JSON object with three keys:

- `matched` — array of YNAB transactions matched to Amazon charges:
  ```json
  {
    "ynab_id": "...",
    "date": "2026-02-10",
    "amount": -44.00,
    "order_id": "250-8134814-7911820",
    "items": ["Panasonic Eneloop Charger..."],
    "current_category": "📦 Amazon Prime",
    "current_memo": ""
  }
  ```
- `unmatched` — YNAB transactions with no Amazon charge match (review manually)
- `categories` — all available YNAB categories with IDs for reference

Progress logging goes to stderr so JSON output stays clean.

### Step 2 — Review & Build Plan

After reviewing the scrape output, build a JSON update plan — an array of objects:

```json
[
  { "ynab_id": "abc-123", "category_id": "cat-456", "memo": "Short product description" },
  ...
]
```

**Category assignment guidance:**

Use the `items` array and `categories` list from Step 1 to pick the best category for each transaction. Common mappings:

| Product type | Likely category |
|---|---|
| Medicine, health supplements | 💊Medical |
| Toiletries, cleaning products | 🛒Groceries |
| Skincare, haircare (adult) | 💅Beauty |
| Electronics, batteries, cables, networking | 👨🏻‍💻Home & Tech |
| Pet food, flea/worming treatments | 🐶Pet |
| Baby bottles, nappies, baby-brand products | 👶 Baby |
| Kids toys, kids accessories | 👶 Misc |
| Clothing, shoes | 👕Clothing |
| Amazon Prime membership (order ID starts with D01-) | 📦 Amazon Prime |

**Memo guidance:** Short description (≤50 chars) with key details — product name, quantity/size if relevant.

### Step 3 — Apply Updates

Pipe the plan JSON into the apply script:

```bash
# Preview first
echo '<plan-json>' | node ~/.pi/agent/skills/ynab/scripts/amazon-reconcile/apply.js --dry-run

# Apply for real
echo '<plan-json>' | node ~/.pi/agent/skills/ynab/scripts/amazon-reconcile/apply.js
```

**Output:** JSON with `success` and `failed` arrays.

### Full Example (agent workflow)

```bash
# 1. Ensure Chrome is running with profile
node ~/.pi/agent/skills/web-browser/scripts/start.js --profile

# 2. Scrape and match
node ~/.pi/agent/skills/ynab/scripts/amazon-reconcile/scrape.js --since 2026-02-01 --account <account-id> > /tmp/amazon-reconcile.json

# 3. Agent reads output, builds plan with categories + memos, confirms with user

# 4. Apply
echo '[...]' | node ~/.pi/agent/skills/ynab/scripts/amazon-reconcile/apply.js
```

### Notes

- The scraper uses the **Amazon Payments Transactions** page (actual card charges) not order totals, so multi-item orders that ship/charge separately are handled correctly.
- Gift card payments are excluded — only Mastercard charges are matched.
- Refunds are excluded from matching.
- Dates and amounts must match exactly between YNAB and Amazon for a match.
- If Chrome is not running or not logged into Amazon, the scrape will fail with a clear error.

## API limitations

The YNAB API does **not** support creating categories, category groups, or payees directly. These must be done in the YNAB web/mobile app. Rate limit: 200 requests/hour per token.

## Attribution

CLI: [@stephendolan/ynab-cli](https://github.com/stephendolan/ynab-cli) (MIT)
