---
name: ops-sherpa-mcp
description: Integrate and orchestrate Atlassian Ops Sherpa MCP (@atlassian/ops-sherpa) for cross-system operational investigations. Use for incident triage, JSM/Opsgenie alert investigation, Splunk error lookup, SignalFx metric checks, deployment correlation, Bitbucket/jCICD diffs, Post Office failure diagnostics, and correlating error spikes across Atlassian infrastructure.
compatibility: Requires an MCP-capable client, Node.js 20+, Atlassian atlas CLI/internal npm registry access, SLauth for Splunk, and service API tokens configured as MCP environment variables.
---

# Ops Sherpa MCP

Use this skill when the user asks for operational investigation across Atlassian systems, including incident triage, JSM/Opsgenie alerts, Splunk or Micros Log Insights searches, SignalFx metrics/detectors, deployment correlation, Bitbucket diffs, jCICD/Commit Tracker checks, Sentry checks, or Post Office failure diagnostics.

Ops Sherpa MCP package: `@atlassian/ops-sherpa`.

## Canonical references

- Ops Sherpa repository: <https://bitbucket.org/atlassian/ops-sherpa/src/main/>
- Setup guide: <https://hello.atlassian.net/wiki/spaces/~712020c0258ee563e24d5596d00dba19a9b240/pages/6684504414/Ops+Sherpa+MCP+Server+-+Setup+Guide>
- Capability audit/tool listing: <https://hello.atlassian.net/wiki/spaces/~63ad4e8cf3e7004f77fd5a24/pages/6790126533/Integrated+Services+Capability+Audit>
- Known limitations/issues: <https://hello.atlassian.net/wiki/spaces/~63ad4e8cf3e7004f77fd5a24/pages/6790288071/Known+Limitations+Issues>
- Codex and MCP integrations guide: <https://hello.atlassian.net/wiki/spaces/~71202021380cc37fb64cbabac7129f573b066a/pages/7688592742/How+to+setup+codex>
- Slack support: `#help-ops-sherpa` (<https://atlassian.enterprise.slack.com/archives/C0A0MV64CBD>)

Before making setup changes, prefer the setup guide and known-limitations page over memory. If the repository or Confluence pages disagree with this skill, follow the newer official source and report the difference.

## Prerequisites

Required local/runtime dependencies:

- Node.js 20+ (`node --version`).
- `npx` from npm.
- Atlassian `atlas` CLI.
- Internal npm registry authentication via `atlas packages secrets`.
- SLauth token for Splunk, generated when needed:

```bash
atlas slauth token --aud splunk.paas-inf.net --ttl 1h --groups atlassian-all --mfa
```

SLauth tokens are short-lived. Never print them in summaries, logs, pull requests, or tickets.

Use the helper for local readiness checks:

```bash
./scripts/ops-sherpa-doctor.sh
```

## MCP configuration

Add Ops Sherpa to the target MCP client config. Prefer pinning the version when reproducibility matters.

Unpinned:

```json
{
  "mcpServers": {
    "ops-sherpa": {
      "command": "npx",
      "args": ["@atlassian/ops-sherpa"],
      "env": {
        "ATLASSIAN_EMAIL": "<your-email>",
        "ATLASSIAN_API_TOKEN": "<redacted>",
        "BITBUCKET_API_TOKEN": "<redacted>",
        "OPS_JIRA_TOKEN": "<redacted>",
        "SIGNALFX_API_TOKEN": "<redacted>",
        "SIGNALFX_REALM": "us1",
        "SENTRY_API_TOKEN": "<redacted>",
        "SPLUNK_TIMEOUT": "60000"
      }
    }
  }
}
```

Pinned example:

```json
{
  "mcpServers": {
    "ops-sherpa": {
      "command": "npx",
      "args": ["@atlassian/ops-sherpa@1.4.0"],
      "env": {
        "ATLASSIAN_EMAIL": "<your-email>",
        "ATLASSIAN_API_TOKEN": "<redacted>",
        "BITBUCKET_API_TOKEN": "<redacted>",
        "OPS_JIRA_TOKEN": "<redacted>",
        "SIGNALFX_API_TOKEN": "<redacted>",
        "SIGNALFX_REALM": "us1",
        "SENTRY_API_TOKEN": "<redacted>",
        "SPLUNK_TIMEOUT": "60000"
      }
    }
  }
}
```

A reusable template is in `references/mcp-config-template.json`.

## Investigation workflow

### 0. Frame the investigation

Collect or infer:

- Alert/JSM/Opsgenie ID, Ops Jira HOT key, incident key, detector name, service, tenant/shard/region, environment, and time window.
- User-visible symptoms and impact claims.
- Safe time bounds. Default to a narrow window: 30 minutes before to 30 minutes after the trigger time.

If the user provides only a vague symptom, ask for the service and approximate time window before running expensive log queries.

### 1. Alert or incident ingestion

Start from the authoritative alert/incident source.

- Use Ops Sherpa alert tools such as `get_alert` for a known alert and `list_alerts` for recent relevant alerts.
- For Ops Jira HOT issues, fetch issue details, status, linked alerts, owners, components, comments, and recent updates.
- Extract: trigger time, affected service/component, severity, dedup key/alias, detector/query, routing/team, responders, runbook links, and any deployment or feature-flag hints.

Do not immediately jump to raw logs. The alert metadata should drive metric/log scope.

### 2. Metric and timeline correlation

Query SignalFx around the trigger time:

- Pull the detector incident and relevant time-series for the affected service, route, queue, dependency, or infrastructure component.
- Compare baseline vs spike window. Prefer bucketed summaries before high-cardinality series.
- Look for correlated indicators: request rate, error rate, latency percentiles, saturation, queue lag, retries, dependency failures, region/shard skew, and deploy markers.
- Record timestamps in UTC unless the incident convention says otherwise; include timezone in the report.

### 3. Log inspection with Splunk and Micros Log Insights

Use narrow, efficient queries. Splunk is easy to overload.

Guardrails:

- Restrict each search window to **≤ 1 hour**; prefer 15-30 minutes for first pass.
- Start with counts/aggregations in 5-minute buckets before fetching raw messages.
- Use `operation=count` or `operation=sample` first where available.
- Filter by service, environment, region, tenant/shard, trace/request ID, error class, status code, route, or host.
- Only fetch raw message samples after the aggregation identifies a promising cluster.
- Redact PII, customer data, auth headers, signed URLs, secrets, and SLauth tokens.

Suggested flow:

1. Count errors by 5-minute bucket around the alert.
2. Break down top error classes/messages/status codes/routes.
3. Sample representative messages for the top 1-3 clusters.
4. If needed, pivot on trace IDs, request IDs, tenant/shard, dependency host, or deployment version.

Avoid broad raw searches such as `error` over a whole day. If a query times out, shrink the window or add filters; do not simply increase timeout.

### 4. Change and deployment correlation

Check recent changes for the affected service before forming a root-cause hypothesis.

- Use Commit Tracker and jCICD/deployment tools for deploys near the alert time.
- Inspect Bitbucket repositories, recent commits, pull requests, release tags, and diffs associated with the deployed artifact.
- Correlate deploy start/end time, version, environment, region, rollout percentage, and author/team with metric/log inflection points.
- Check whether rollback, forward fix, or config revert is available and whether similar deploys affected other environments.

If feature flags are suspected, note the Switcheroo limitation below and verify manually in the UI or via another supported source.

### 5. Synthesis and report

Return a structured Markdown report, not a stream of tool output.

Use this template:

```markdown
# Investigation Summary: <alert/service/time>

## Timeline & Impact
- <timestamp>: <event>
- Impact: <known impact, scope, affected tenants/regions, confidence>

## Correlated Logs & Metrics
- Metrics: <SignalFx detectors/time-series, spike magnitude, baseline comparison>
- Logs: <Splunk/Micros aggregated findings, sample IDs if safe, redacted examples>
- Changes: <deployments, commits, PRs, config changes, feature flags checked>

## Probable Root Cause Hypothesis
<one or more hypotheses with confidence and evidence for/against each>

## Recommended Human Next Steps / Mitigations
1. <mitigation or owner action>
2. <verification query/dashboard/runbook>
3. <rollback/disable/retry/escalation if appropriate>

## Gaps / Follow-ups
- <missing access, timed-out query, manual UI check, unverified assumption>
```

Be explicit about confidence. Separate evidence from speculation. Include links to safe internal artifacts where available, but do not include secrets or signed URLs.

## Post Office failure diagnostics

For Post Office or mail/event-delivery failures:

1. Start from alert/JSM/Opsgenie/Ops Jira context and affected tenant/shard/region.
2. Check SignalFx for delivery latency, queue depth, retry rate, dead-letter/error metrics, and dependency health.
3. Use Splunk/Micros aggregations to group failures by provider, template/event type, status code, exception, tenant/shard, and deployment version.
4. Correlate with recent deployments/config changes in Bitbucket/jCICD.
5. Report whether the failure appears systemic, regional, tenant-specific, provider-specific, or deployment-correlated.

## Safety and guardrails

### Read vs write safety

Ops Sherpa is primarily read-only (roughly 72 read tools vs 11 write tools in the capability audit), but it does include mutating tools. Treat these as requiring explicit user confirmation unless the user already gave a clear, specific instruction for that exact mutation.

Mutating/destructive examples that need confirmation:

- Adding alert notes or comments.
- Acknowledging, closing, suppressing, or changing alert state.
- Triggering event replays, retries, rollbacks, or mitigations.
- Editing Jira/Ops Jira issues, assignees, labels, severity, or status.
- Any write to Bitbucket, Sentry, SignalFx, Splunk saved searches, Switcheroo, or deployment systems.

Before a mutation, state the exact action, target ID, expected effect, and rollback/undo path if known.

### Switcheroo tooling blocker

Known limitation: Switcheroo feature flag tools currently return `400 Bad Request` due to tRPC caller validation. If feature flags are suspected, do not repeatedly retry the failing Ops Sherpa tools. Fall back to manual UI verification or another supported source, and record the gap in the report.

### Security, UGC, and PII

Never output:

- Raw SLauth tokens, API tokens, cookies, auth headers, secrets, private keys, or credentials.
- Customer PII, UGC, personal data, email/message bodies, or full payloads unless explicitly approved and necessary.
- Signed URLs or expiring internal download links.
- High-volume raw logs copied wholesale.

Prefer aggregated findings and short redacted samples. Use placeholders such as `<redacted-token>`, `<customer-id-redacted>`, and `<signed-url-redacted>`.

## Troubleshooting

- `npx` cannot resolve `@atlassian/ops-sherpa`: run `atlas packages secrets` and verify internal npm registry auth.
- Splunk auth failures: refresh SLauth with `atlas slauth token --aud splunk.paas-inf.net --ttl 1h --groups atlassian-all --mfa`.
- Splunk timeouts: reduce to ≤30 minutes, add service/env filters, and aggregate first.
- SignalFx errors: verify `SIGNALFX_REALM` (for example `us1`) and `SIGNALFX_API_TOKEN`.
- Bitbucket errors: verify `BITBUCKET_API_TOKEN` and repository permissions.
- Tool schema errors: check the capability audit and current setup guide; tool names/arguments may have changed.
- Persistent Ops Sherpa issues: ask in `#help-ops-sherpa` with package version, client name, sanitized error, and timestamp.
