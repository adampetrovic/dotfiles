# 1Password CLI Session Handling

Agent tool calls run in fresh shell processes, so environment variables exported in one `bash` call do not automatically persist into later calls.

There are two common auth modes:

1. **Manual-account / service-token auth** can provide a reusable token (`OP_SESSION` or `OP_SERVICE_ACCOUNT_TOKEN`). This can be persisted across agent tool calls.
2. **1Password desktop app integration** usually does **not** expose an `OP_SESSION` token; `op signin --raw` may return an empty string. In that mode, a token-file cache cannot solve repeated authorization prompts across fresh tool calls.

## Preferred Order

1. **Best:** run the whole workflow inside one long-lived `op run` process.
2. **Good for automation:** use a tightly scoped `OP_SERVICE_ACCOUNT_TOKEN`.
3. **Good with manual CLI sign-in:** cache `OP_SESSION` in a private file and reload it for each tool call.
4. **Desktop app integration only:** do **not** add `op whoami` / `op signin` preflights before every command; they can create extra prompts and still cannot persist auth across fresh tool calls. Use one direct `op run` around the whole workflow instead.

## Manual-account Session Cache Pattern

Use this only when `op signin --raw` returns a non-empty session token.

```bash
export OP_ACCOUNT="${OP_ACCOUNT:-my.1password.com}"
export OP_SESSION_FILE="${OP_SESSION_FILE:-$HOME/.cache/pi-agent/op-session}"
mkdir -p "$(dirname "$OP_SESSION_FILE")"
chmod 700 "$(dirname "$OP_SESSION_FILE")"

# Reuse an existing manual-session token if present.
if [[ -r "$OP_SESSION_FILE" ]]; then
  export OP_SESSION="$(<"$OP_SESSION_FILE")"
fi

# Refresh only when the cached token is absent/expired.
if ! op whoami --account "$OP_ACCOUNT" >/dev/null 2>&1; then
  umask 077
  OP_SESSION="$(op signin --account "$OP_ACCOUNT" --raw || true)"
  if [[ -n "$OP_SESSION" ]]; then
    printf '%s' "$OP_SESSION" > "$OP_SESSION_FILE"
    chmod 600 "$OP_SESSION_FILE"
    export OP_SESSION
  else
    # Desktop app integration path: no token to persist.
    rm -f "$OP_SESSION_FILE"
    op signin --account "$OP_ACCOUNT" >/dev/null
  fi
fi

op run --account "$OP_ACCOUNT" --env-file=<env-file> -- <command>
```

## Rules

- Prefer one long-running `op run` around an entire workflow instead of many small `op run` calls.
- If multiple `op run` calls are unavoidable and a non-empty `OP_SESSION` can be obtained, prepend the session bootstrap above to each shell command so the same token is reused across agent tool calls.
- Store only the short-lived 1Password session token in the session file; never write resolved secrets to disk.
- Keep the session file private: directory `0700`, file `0600`, `umask 077`.
- Delete the cache with `rm -f "$OP_SESSION_FILE"` if authentication behaves strangely or when forcing a fresh sign-in.
- If `op signin --raw` returns empty, the setup is using desktop app integration and there is no `OP_SESSION` to persist. Do not keep retrying `op signin` / `op whoami` in that mode.
