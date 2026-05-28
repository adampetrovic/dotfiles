#!/usr/bin/env bash
# Wrapper that runs tg.py with the skill's venv Python
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/../.venv/bin/python3" "$SCRIPT_DIR/tg.py" "$@"
