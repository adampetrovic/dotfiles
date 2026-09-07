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

SLauth tokens are short-lived. Never print them in summaries, logs, pull requests, or tickets. For Ops Sherpa MCP, do not store the printed SLauth token in `mise` or MCP JSON; Ops Sherpa uses SLauth through the `atlas` CLI, and running the command refreshes/proves your local SLauth/MFA session for about an hour.

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

### Mise/global environment wrapper

If secrets are supplied by global `mise` configuration, avoid copying them into the MCP client JSON. Point the MCP client at the wrapper script instead:

```json
{
  "mcpServers": {
    "ops-sherpa": {
      "command": "/Users/apetrovic/.pi/agent/skills/ops-sherpa-mcp/scripts/ops-sherpa-mcp.sh",
      "args": []
    }
  }
}
```

The wrapper validates required env vars, then runs `npx --yes @atlassian/ops-sherpa@1.4.0`. Override with `OPS_SHERPA_PACKAGE=@atlassian/ops-sherpa` or another pinned version if needed. See `references/mcp-config-mise-wrapper.json`.

For global mise env, configure the required variables in your global mise config using your normal secret source. Do not commit plaintext tokens. The wrapper retries once through `mise exec --` if Codex did not inherit an activated shell environment.

After changing mise config, open a fresh shell and run the doctor. Do **not** paste `mise env` output into chat or tickets because it can print secrets.

```bash
./scripts/ops-sherpa-doctor.sh
```

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

#### Sliver archetype logs

For Sliver/archetype logs, prefer the generated Splunk macros when the user names an archetype, env type, or shard.

Macro format:

- `` `sliver_<archetype>_all` ``
- `` `sliver_<archetype>_dev` ``
- `` `sliver_<archetype>_staging` ``
- `` `sliver_<archetype>_prod` ``

These macros include commercial-perimeter shards for the selected env type.

Go link format for human handoff:

```text
http://go/logs/<envType>/<archetype>/<query?>/<timeframe?>
```

Examples:

```text
http://go/logs/dev/raptor-archetype
http://go/logs/prod/raptor-archetype/level=ERROR/24h
```

Natural-language mapping:

- “check logs for `tdp-os-prod-east-01` shard” → infer env type `prod`, shard `tdp-os-prod-east-01`, and likely archetype `tdp-os-archetype` unless evidence says otherwise.
- Start with a macro count query such as:

```spl
search `sliver_tdp-os-archetype_prod` (tdp-os-prod-east-01 OR shard=tdp-os-prod-east-01 OR micros_shard=tdp-os-prod-east-01 OR cell=tdp-os-prod-east-01)
| timechart span=5m count
```

- If that returns zero, run a bounded field-discovery/sample query against `` `sliver_tdp-os-archetype_prod` `` for the same ≤15-30 minute window to identify the correct shard/cell field before broadening.
- For service-only Micros logs where Sliver macro is not applicable, fall back to `` `micros_<service>` `` with application-log sidecar exclusions.

#### TDP OS application log fields and slices

Observed against `tdp-os-stg-east-01` with `` `sliver_tdp-os-archetype_staging` `` and confirmed from `~/code/tdp-os` logging classes.

Use this taxonomy to avoid confusing common log-envelope fields with custom application fields emitted by individual log statements.

##### Log slices

- **Main OS application logs:** `m.t=application micros_container=tdpos`. Use this by default for product/application behavior.
- **OS support application containers:** `m.t=application (micros_container=hofund OR micros_container=uploader)`.
- **Platform/sidecar logs:** `micros_container=platform-*`; examples include `platform-statsd-psapi`, `platform-service-proxy-ingress`, `platform-metricshostagent`, `platform-tracing-psapi`, and `platform-tcs`.
- **System/kernel/syslog-like logs:** `m.t=syslog micros_container=platform-logging`.

Only include `platform-*` or `m.t=syslog` when investigating sidecar, proxy, logging pipeline, host, kernel, or infrastructure symptoms.

##### Platform / Micros envelope fields

These fields are common logging/Splunk/Micros envelope fields, not custom per-call-site fields:

- `_time` = Splunk event timestamp.
- `env` = Micros environment, e.g. `stg-east`, `prod-east`.
- `m.t` = log type, e.g. `application`, `platform`, `syslog`.
- `m.si` = Micros service ID (`micros_service_id`), e.g. `tdp-os-stg-east-01` or `tdp-os-prod-east-01`. Prefer this over free-text shard matching once discovered.
- `m.sv` = service version/build metadata; useful for deploy correlation when populated.
- `m.g` = Micros group/archetype-ish metadata.
- `m.di` = deployment/runtime identity metadata.
- `micros_container` = container/source within the shard.
- `host` = backing host/IP name.
- `source`, `sourcetype`, `index` = Splunk source metadata; usually unnecessary when using Sliver macros.
- `ec2.az`, `ec2.id`, `ec2.ip`, `ec2.hn`, `ec2.sn` = EC2/runtime metadata. `ec2.sn` is especially useful for build/deploy correlation because it contains shard, env, build number, commit-ish ID, UTC timestamp, and EC2 suffix.

##### Standard log event fields

These are common log-framework/encoder fields:

- `level` = log level.
- `logger_name` = logger/class name. Useful for grouping noisy code paths.
- `message` = human log message.
- `stackTrace` or exception-related top-level fields = throwable details when the log call includes an exception.
- `thread_name` or similar thread fields, when emitted by the Micros JSON encoder.

##### TDP OS common context fields

TDP OS `StructuredLogger` / `CoStructuredLogger` merges a common logging context under `os`, while additional per-log properties go under `md`. Common `os.*` fields include:

- `os.pId` = partition ID.
- `os.iss` = issuer.
- `os.sub` = subject.
- `os.ti` = ASAP token ID.
- `os.tCl` = traffic class.
- `os.bK` = bucket key.
- `os.oId` = object ID.
- `os.uId` = upload ID.
- `os.r.p` = request path or route pattern.
- `os.r.m` = request HTTP method.
- `os.r.qP` = request query parameters when captured.
- `os.tId` = trace ID.
- `os.spId` = HTTP server span ID.
- `os.git.commitId`, `os.git.branch` = non-prod common properties only; prod omits them because the commit can be found via service version metadata.

##### Access-log exception

Normal application logs should treat `md.*` as custom per-log properties. Access logs are the main exception: `AccessLogConfiguration` emits a consistent access-log shape with common `md.*` fields such as:

- `md.accessTime`
- `md.httpMethod`
- `md.path`
- `md.httpStatus`
- `md.duration`
- `md.requestLength`
- `md.responseLength`
- `md.userAgent`
- `md.protocol`
- `md.requestTraceId`
- `md.Atl-TraceId`
- `md.baggage` with an allowlisted subset of baggage entries

##### Custom field guardrail

For non-access application logs, do **not** assume arbitrary `md.*` fields are common. `StructuredLogger` and `CoStructuredLogger` place call-site additional properties under `md`, so fields like `md.exceptionType`, `md.httpStatus`, object/version fields, queue names, migration fields, or domain-specific IDs may be useful but are controlled by the code emitting that specific log.

##### SPL dot-field rule

For aggregation, rename dotted fields first rather than grouping on them directly:

```spl
| rename m.si as micros_service_id m.t as log_type ec2.sn as ec2_service_name os.pId as partition_id os.tId as trace_id
| stats count by micros_service_id env micros_container log_type
```

Recommended first-pass shard query:

```spl
search `sliver_tdp-os-archetype_staging` m.si=tdp-os-stg-east-01 m.t=application micros_container=tdpos
| timechart span=5m count
```

Recommended slice-discovery query:

```spl
search `sliver_tdp-os-archetype_staging` tdp-os-stg-east-01
| rename m.si as micros_service_id m.t as log_type ec2.sn as ec2_service_name
| stats count dc(host) as hosts values(micros_container) as containers by micros_service_id env log_type
| sort - count
```

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
