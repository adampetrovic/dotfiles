#!/usr/bin/env bash
set -euo pipefail

min_node_major=20

say() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

say "Ops Sherpa MCP readiness check"
say "================================"

if ! command -v node >/dev/null 2>&1; then
  fail "node is not installed; install Node.js ${min_node_major}+"
fi
node_version="$(node -v | sed 's/^v//')"
node_major="${node_version%%.*}"
if [[ "${node_major}" -lt "${min_node_major}" ]]; then
  fail "node ${node_version} found; Node.js ${min_node_major}+ required"
fi
say "OK node: $(command -v node) (${node_version})"

if ! command -v npx >/dev/null 2>&1; then
  fail "npx is not installed; install npm with Node.js"
fi
say "OK npx: $(command -v npx)"

if ! command -v atlas >/dev/null 2>&1; then
  warn "atlas CLI not found. Install/configure atlas before using @atlassian/ops-sherpa."
else
  say "OK atlas: $(command -v atlas)"
  say "Hint: run 'atlas packages secrets' if npx cannot resolve @atlassian/ops-sherpa."
  say "Hint: refresh Splunk SLauth with: atlas slauth token --aud splunk.paas-inf.net --ttl 1h --groups atlassian-all --mfa"
fi

required_env=(
  ATLASSIAN_EMAIL
  ATLASSIAN_API_TOKEN
  BITBUCKET_API_TOKEN
  OPS_JIRA_TOKEN
  SIGNALFX_API_TOKEN
  SIGNALFX_REALM
  SENTRY_API_TOKEN
  SPLUNK_TIMEOUT
)

missing=0
for name in "${required_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    warn "missing env var: ${name}"
    missing=1
  else
    case "${name}" in
      *_TOKEN|*_API_TOKEN)
        say "OK env: ${name}=<redacted>"
        ;;
      *)
        say "OK env: ${name}=${!name}"
        ;;
    esac
  fi
done

if [[ "${missing}" -eq 1 ]]; then
  warn "Configure missing variables in your MCP client's ops-sherpa env block."
else
  say "OK required MCP env vars are present in this shell."
fi

say ""
say "MCP server command: npx @atlassian/ops-sherpa@1.4.0"
say "This doctor does not start the server or print secrets."
