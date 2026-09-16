load_homebrew_github_api_token() {
    local record_title="Homebrew GitHub API Token"
    local token

    if ! command -v keeper >/dev/null 2>&1; then
        log_warn "Keeper Commander CLI is required to access private Homebrew repositories"
        return 1
    fi

    if ! command -v python3 >/dev/null 2>&1; then
        log_warn "python3 is required to read the Homebrew token from Keeper"
        return 1
    fi

    token="$({ keeper get --format=json "$record_title" || true; } | python3 -c '
import json
import sys

try:
    record = json.load(sys.stdin)
    fields = record["data"]["fields"]
    values = next(field.get("value", []) for field in fields if field.get("type") == "password")
    token = values[0] if values else ""
except (KeyError, IndexError, StopIteration, TypeError, ValueError, json.JSONDecodeError):
    token = ""

sys.stdout.write(str(token))
')"

    if [ -z "$token" ]; then
        unset token
        log_warn "Could not read a password from Keeper record: $record_title"
        return 1
    fi

    export HOMEBREW_GITHUB_API_TOKEN="$token"
    unset token
}
