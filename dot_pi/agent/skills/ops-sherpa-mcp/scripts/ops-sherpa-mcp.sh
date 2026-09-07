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

missing=()
for name in ATLASSIAN_EMAIL ATLASSIAN_API_TOKEN BITBUCKET_API_TOKEN OPS_JIRA_TOKEN SIGNALFX_API_TOKEN SIGNALFX_REALM SENTRY_API_TOKEN SPLUNK_TIMEOUT; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Ops Sherpa MCP missing required environment variables:\n' >&2
  printf '  %s\n' "${missing[@]}" >&2
  printf 'Configure them in global mise or the MCP client env block.\n' >&2
  exit 2
fi

exec npx --yes "$PACKAGE"
