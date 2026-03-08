#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="things3-manager"
SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SKILL_DATA_DIR="$SKILL_ROOT/.skills-data"
PYTHON_VENV="$SKILL_DATA_DIR/venv"
PYTHON_PYCACHE_PREFIX="$SKILL_DATA_DIR/cache/pycache"

mkdir -p "$SKILL_DATA_DIR/bin" "$SKILL_DATA_DIR/logs" "$SKILL_DATA_DIR/cache" "$SKILL_DATA_DIR/tmp" "$PYTHON_PYCACHE_PREFIX"

ENV_FILE="$SKILL_DATA_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
SKILL_ROOT="$SKILL_ROOT"
SKILL_NAME="$SKILL_NAME"
SKILL_DATA_DIR="$SKILL_DATA_DIR"
PYTHON_VENV="$PYTHON_VENV"
EOF
  echo "Wrote $ENV_FILE"
else
  echo "Exists: $ENV_FILE (leaving as-is)"
fi

if [[ ! -d "$PYTHON_VENV" ]]; then
  python3 -m venv "$PYTHON_VENV"
fi

export PIP_CACHE_DIR="$SKILL_DATA_DIR/cache/pip"

WRAPPER="$SKILL_DATA_DIR/bin/things"
cat >"$WRAPPER" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DATA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1090
source "$SKILL_DATA_DIR/.env"

export PYTHONPYCACHEPREFIX="$SKILL_DATA_DIR/cache/pycache"

exec "$PYTHON_VENV/bin/python" "$SKILL_ROOT/scripts/things_cli.py" "$@"
EOF
chmod +x "$WRAPPER"
echo "Installed $WRAPPER"

if ! "$PYTHON_VENV/bin/python" -c "import things" >/dev/null 2>&1; then
  "$PYTHON_VENV/bin/python" -m pip install "things-py>=0.0.15"
fi
