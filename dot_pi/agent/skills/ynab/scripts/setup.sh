#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="ynab"
SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DATA_DIR="${SKILL_DATA_DIR:-$SKILL_ROOT/.skills-data}"

mkdir -p "$SKILL_DATA_DIR/logs" "$SKILL_DATA_DIR/cache" "$SKILL_DATA_DIR/tmp"

# --- Ensure bun is installed ---
if ! command -v bun >/dev/null 2>&1; then
  echo "Installing bun via mise..."
  mise install bun
  mise use --global bun
fi

# --- Ensure ynab CLI is installed ---
YNAB_BIN=""
if command -v ynab >/dev/null 2>&1; then
  YNAB_BIN="$(command -v ynab)"
elif [[ -x "$HOME/.bun/bin/ynab" ]]; then
  YNAB_BIN="$HOME/.bun/bin/ynab"
else
  echo "Installing @stephendolan/ynab-cli..."
  bun install -g @stephendolan/ynab-cli
  YNAB_BIN="$HOME/.bun/bin/ynab"
fi

echo "ynab CLI: $YNAB_BIN"

# --- Write .env ---
ENV_FILE="$SKILL_DATA_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
SKILL_ROOT="$SKILL_ROOT"
SKILL_NAME="$SKILL_NAME"
SKILL_DATA_DIR="$SKILL_DATA_DIR"
YNAB_BIN="$YNAB_BIN"
EOF
  echo "Wrote $ENV_FILE"
else
  echo "Exists: $ENV_FILE (leaving as-is)"
fi

# --- Check auth ---
export PATH="$HOME/.bun/bin:$PATH"
AUTH_STATUS=$("$YNAB_BIN" auth status 2>&1 || true)
if echo "$AUTH_STATUS" | grep -q '"authenticated": false'; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  YNAB API token required.                               ║"
  echo "║                                                         ║"
  echo "║  1. Go to: https://app.ynab.com/settings/developer      ║"
  echo "║  2. Create a Personal Access Token                      ║"
  echo "║  3. Either:                                             ║"
  echo "║     a) Run: ynab auth login                             ║"
  echo "║     b) Add YNAB_API_KEY=<token> to:                    ║"
  echo "║        $ENV_FILE"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
fi

echo "Setup complete."
