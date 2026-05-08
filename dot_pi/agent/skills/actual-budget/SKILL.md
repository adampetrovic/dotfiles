---
name: actual-budget
description: Query and manage personal finances via the Actual Budget Node.js API. Use when the user asks about budget, spending, account balances, transactions, categories, rules, importing bank data, or any Actual Budget operation.
---

# Actual Budget

CLI wrapper around the official `@actual-app/api` for self-hosted [Actual Budget](https://actualbudget.org) instances.

## Setup

Install dependencies (once):

```bash
cd ~/.pi/agent/skills/actual-budget && npm install
```

## Environment Variables

The CLI reads all config from environment variables. Use `op run` to inject secrets.

| Variable | Required | Description |
|----------|----------|-------------|
| `ACTUAL_SERVER_URL` | Yes | Server URL |
| `ACTUAL_PASSWORD` | Yes | Server password |
| `ACTUAL_SYNC_ID` | Yes | Budget sync ID (Settings → Advanced) |
| `ACTUAL_ENCRYPTION_KEY` | No | E2E encryption password (if enabled) |
| `ACTUAL_DATA_DIR` | No | Local cache dir (default: `/tmp/actual-budget-skill-cache`) |

**The specific `op://` references and sync ID for this user are in AGENTS.md** — check there for the concrete `op run` invocation to use.

## Running Commands

All commands go through the CLI wrapper. The `op run` prefix injects secrets:

```bash
op run --env-file=<env-file> -- node ~/.pi/agent/skills/actual-budget/scripts/actual.js <command> [args]
```

Refer to AGENTS.md for the exact invocation with the user's 1Password references.

## Operating Rules

- **Read before write.** Always list/query first to discover IDs, names, and current state.
- **Confirm writes.** Before any mutation (create, import, set-budget, delete), summarize the changes and ask for confirmation.
- **Use names, not IDs.** The CLI resolves category and account names internally — pass human-readable names.
- **Amounts are in dollars.** `--amount 50` means $50.00. The CLI handles cents conversion.
- **Dates use ISO format.** `YYYY-MM-DD` for transactions, `YYYY-MM` for budget months.
- **All output is JSON.** Parse it; don't show raw dumps to the user unless asked.

## Commands Reference

### Accounts

```bash
actual accounts                    # List all accounts with balances
```

### Categories

```bash
actual categories                  # List category groups with categories
actual create-category "Eating Out" "Lifestyle"   # Create category in group
actual delete-category "Old Cat"                   # Delete a category
```

### Budget

```bash
actual months                              # List all budget months
actual budget 2026-04                      # Show April budget (budgeted/spent/balance per category)
actual set-budget 2026-04 Groceries 1200   # Set Groceries to $1,200 for April
```

### Transactions

```bash
actual transactions --account Mastercard --since 2026-04-01 --until 2026-04-30
actual transactions --account "Westpac Offset" --since 2026-04-01
```

### Import Transactions

Pipe a JSON array to stdin. Each object: `{ date, amount (cents), payee_name, notes?, category?, imported_id?, cleared? }`.

Category names are resolved automatically. `imported_id` enables deduplication on re-import.

```bash
echo '[
  {"date":"2026-04-05","amount":-2500,"payee_name":"Coles","category":"Groceries","notes":"Weekly shop"},
  {"date":"2026-04-06","amount":-1200,"payee_name":"KFC","category":"Eating Out","notes":"Dinner"}
]' | actual import-transactions --account Mastercard
```

### Update Transaction

```bash
actual update-transaction <txn-id> --category "Eating Out" --notes "Lunch"
actual update-transaction <txn-id> --cleared true
```

### Payees

```bash
actual payees                      # List all payees (excludes transfer payees)
```

### Rules

```bash
actual rules                       # List all categorization rules
actual create-rule --payee "Coles" --category "Groceries"
```

### ActualQL Queries

Pass a JSON query definition for complex reporting:

```bash
# Total spending by category this month
actual query '{"table":"transactions","filter":{"date":[{"$gte":"2026-04-01"},{"$lte":"2026-04-30"}],"amount":{"$lt":0}},"groupBy":"category.name","select":["category.name",{"total":{"$sum":"$amount"}}]}'

# Search transactions by payee
actual query '{"table":"transactions","filter":{"payee.name":{"$like":"%coles%"}},"select":["date","amount","payee.name","category.name","notes"],"orderBy":{"date":"desc"},"limit":20}'
```

**Query shape:** `{ table, filter?, select?, groupBy?, orderBy?, limit?, options? }`
**Operators:** `$eq`, `$lt`, `$lte`, `$gt`, `$gte`, `$ne`, `$oneof`, `$regex`, `$like`, `$notlike`

## CommBank CSV Import Workflow

No bank sync is available in Australia. To import transactions:

1. User exports CSV from CommBank (netbank or app)
2. Agent reads the CSV, maps columns to the JSON format above
3. Pipes JSON into `actual import-transactions --account <name>`
4. The `imported_id` field should be derived from date+amount+description for dedup
5. Review uncategorized transactions and apply categories

CommBank CSV columns: `Date, Amount, Description, Balance` (no unique transaction ID — OFX exports have broken empty FITIDs).

## Tips

- **Transfers** use special payees. List payees to find `transfer_acct` entries.
- **Split transactions** can be imported with a `subtransactions` array.
- **Budget carryover**: `set-budget` only sets the amount; carryover toggle must be done in the UI.
- **Rules fire on import**: create rules first, then import — transactions get auto-categorized.
