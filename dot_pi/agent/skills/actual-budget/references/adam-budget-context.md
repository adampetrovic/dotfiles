# Adam's Actual Budget Context

Self-hosted Actual Budget instance for the Petrovic family. Migrated from YNAB in March 2026. April 2026 is the first tracked month.

## Connection

All commands use the local mise task: `mise` pins Node and dependencies, loads the local `.mise.toml` environment, and `op run` resolves the `op://Private/Actual/...` secret references.

```bash
cd ~/.pi/agent/skills/actual-budget
mise run actual <command> [args]
```

Current local config:

- `ACTUAL_SERVER_URL`: `op://Private/Actual/website`
- `ACTUAL_PASSWORD`: `op://Private/Actual/password`
- `ACTUAL_ENCRYPTION_KEY`: `op://Private/Actual/encryption key`
- `ACTUAL_SYNC_ID`: `ce59fb57-248e-4fd6-90a8-73ff9b8d40b9` (Petrovic Budget group ID)
- `ACTUAL_DATA_DIR`: `/tmp/actual-budget-skill-cache`

Do not resolve or print secret values.

## Budget Structure

| Group | Categories | Monthly Targets |
|-------|------------|-----------------|
| **Committed** | Mortgages, Bills, Rates & Utilities | $7,320 / $3,360 / $725 |
| **Essentials** | Groceries, Medical, Family, Transport, Home | $1,200 / $415 / $530 / $305 / $320 |
| **Lifestyle** | Eating Out, Leisure, Clothing, Tech, Gifts, Beauty | — / $700 / $300 / $600 / $250 / $150 |
| **Future** | Emergency Fund, Tax, Zoey's Savings, Eliza's Savings, New Home, Holidays | — |
| **Buffer** | Unsorted | $0 |

**Philosophy:** Committed = set and forget; Essentials = optimise; Lifestyle = hard caps; Future = surplus flows here.

## Accounts

**On-budget:** Westpac Offset (checking), Share Savings, Mastercard (credit), CoinJar, CBA Savings, Safe, Zoey's Savings, Eliza's Savings, Cash

**Off-budget:** Panania Loan, Potts Hill Loan, Malvern St, Tallowood, Shares, Adam's Super, Odette's Super, Tax Account, Tesla Model Y, Tesla Model 3, Rolex

## Australian Quirks

- No bank sync — import via CommBank CSV exports or browser extraction workflows.
- CommBank CSV format: `Date, Amount, Description, Balance`.
- CommBank OFX exports have broken empty FITIDs.
- Credit cards use Actual's default overspend behaviour; there is no special credit-card category.
- One Income category; payee identifies source, e.g. Atlassian or Sydney Catholic Schools.

## Related References

- Logseq planning page: `[[Pi Agent/Budget Overhaul 2026]]`
- Savings plan: `~/code/ynab/SAVINGS_PLAN.md`
- Infrastructure: Kubernetes cluster in `~/code/home-ops`, OpenID via Authelia, E2E encrypted
