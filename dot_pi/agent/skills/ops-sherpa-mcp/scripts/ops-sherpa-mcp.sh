#!/usr/bin/env bash
set -euo pipefail

# Ops Sherpa MCP launcher that relies on the caller's environment.
# Recommended use: put required secret env vars in global mise config, then point
# MCP clients at this script so tokens are not copied into client JSON files.
#
# Required env vars:
#   ATLASSIAN_EMAIL ATLASSIAN_API_TOKEN BITBUCKET_API_TOKEN OPS_JIRA_TOKEN
#   SIGNALFX_API_TOKEN SIGNALFX_REALM SENTRY_API_TOKEN SPLUNK_TIMEOUT
#
# Internal npm registry auth is still required:
#   atlas packages secrets

PACKAGE="${OPS_SHERPA_PACKAGE:-@atlassian/ops-sherpa@1.4.0}"

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

missing=()
for name in "${required_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

# If Codex did not inherit an activated shell, retry once through mise so global
# mise env vars are loaded without copying secrets into ~/.codex/config.toml.
if (( ${#missing[@]} > 0 )) && [[ -z "${OPS_SHERPA_MISE_REEXEC:-}" ]] && command -v mise >/dev/null 2>&1; then
  export OPS_SHERPA_MISE_REEXEC=1
  exec mise exec -- "$0" "$@"
fi

if (( ${#missing[@]} > 0 )); then
  printf 'Ops Sherpa MCP warning: some integration environment variables are missing; affected tools may be unavailable:\n' >&2
  printf '  %s\n' "${missing[@]}" >&2
  printf 'Continuing so SLauth/atlas-backed tools such as Splunk can still be used.\n' >&2
fi

exec npx --yes "$PACKAGE"
