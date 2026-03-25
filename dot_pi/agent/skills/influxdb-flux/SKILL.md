---
name: influxdb-flux
description: Query and explore InfluxDB v2 using Flux, with secure credential handling and schema discovery for Home Assistant and IotaWatt data.
---

# InfluxDB v2 (Flux) Skill

Use this skill when the user asks to query, explore, or analyze data in InfluxDB v2 with Flux, especially for Home Assistant (`homeassistant`) and IotaWatt (`iotawatt`) buckets.

## Configuration & Credential Handling

Always use environment variables first:

- `INFLUXDB_URL`
- `INFLUXDB_ORG`
- `INFLUXDB_TOKEN`

If one or more are missing, **prompt the user** for the missing values before running queries.

Security rules:

- Never print token values back to the user.
- Never include token values in command output or logs.
- Prefer passing the token as an env var in command context.
- If the user supplies credentials directly in chat, treat as sensitive and avoid repeating them.

Defaults in this environment (use only if env vars are unset and user approves):

- URL: `https://influx.petrovic.network`
- Org: `71d6d270b25881e5`
- Buckets: `homeassistant`, `iotawatt`
- Timezone for business/day windows: `Australia/Sydney`

## Tooling

Prefer InfluxDB HTTP API calls if `influx` CLI is unavailable.

HTTP API query pattern:

```bash
curl -sS "$INFLUXDB_URL/api/v2/query?org=$INFLUXDB_ORG" \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  -H "Accept: application/csv" \
  -H "Content-type: application/vnd.flux" \
  --data-binary '<FLUX_QUERY>'
```

CLI pattern (if installed):

```bash
INFLUX_HOST="$INFLUXDB_URL" \
INFLUX_ORG="$INFLUXDB_ORG" \
influx query --token "$INFLUXDB_TOKEN" --file <query.flux>
```

## Required Workflow

1. Validate required env vars are present (`INFLUXDB_URL`, `INFLUXDB_ORG`, `INFLUXDB_TOKEN`).
2. If missing, ask user for missing values.
3. Start with schema discovery queries if structure is unknown.
4. Confirm discovered measurements/tags/fields with sampled output.
5. Build task-specific queries only after confirming data shape.

## Known Live Dataset Shape (discovered)

This section reflects discovered structure from your live instance and should be used to accelerate queries.

### Buckets

- `homeassistant`
- `iotawatt`

### `homeassistant` bucket

Observed measurement pattern:

- Measurements appear to be **unit-centric** rather than domain-centric.
- Examples: `kWh`, `W`, `kW`, `V`, `A`, `°C`, `%`, `hPa`, `AUD`, `AUD/kWh`, `Wh`, `VA`, `var`, `mm`, `km/h`, `UV index`, etc.

Observed tags for sampled measurements (`kWh`, `°C`):

- `domain`
- `entity_id`
- `friendly_name`
- `source`

Observed field-key behavior:

- Field keys are highly varied and include both numeric and `_str` variants.
- This suggests mixed sensor export style; do not assume `_field == "value"` for Home Assistant.
- Always inspect field keys for selected measurement + entity before analysis.

### `iotawatt` bucket

Observed measurements:

- `AirConditioner`
- `Branch`
- `GridA_V`
- `GridB_V`
- `GridC_V`
- `GridImport`
- `Kitchen`
- `Laundry`
- `LightsGPO`
- `Pool`
- `Server`
- `SolarA_PF`
- `SolarB_PF`
- `SolarC_PF`
- `SolarExport`
- `SolarGeneration`
- `Tesla`

Observed tag keys:

- `device`
- `name`
- `unit`

Observed field keys:

- `value` (single canonical field)

Observed `unit` tag values:

- `Watts`
- `Wh`
- `Volts`
- `PF`

Interpretation:

- IotaWatt is cleanly modeled as circuit/stream measurements with `value` and semantic context in tags.
- Prefer filtering by `unit` when mixing measurements to avoid unit-confused aggregations.

## Schema Discovery Playbook

When user asks arbitrary questions, run this flow first (per bucket):

### 1) List measurements

```flux
import "influxdata/influxdb/schema"

schema.measurements(bucket: "homeassistant", start: -365d)
```

Repeat for `iotawatt`.

### 2) List tag keys by measurement

```flux
import "influxdata/influxdb/schema"

schema.tagKeys(
  bucket: "homeassistant",
  predicate: (r) => r._measurement == "<measurement>",
  start: -365d,
)
```

### 3) List field keys by measurement

```flux
import "influxdata/influxdb/schema"

schema.fieldKeys(
  bucket: "homeassistant",
  predicate: (r) => r._measurement == "<measurement>",
  start: -365d,
)
```

### 4) Sample rows for shape verification

```flux
from(bucket: "homeassistant")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "<measurement>")
  |> limit(n: 20)
```

### 5) Enumerate key tag values (example)

```flux
import "influxdata/influxdb/schema"

schema.tagValues(
  bucket: "homeassistant",
  tag: "entity_id",
  predicate: (r) => r._measurement == "<measurement>",
  start: -365d,
)
```

## Practical Query Heuristics

### Home Assistant

- First pick measurement by unit that matches the metric intent (e.g., `kWh`, `W`, `°C`).
- Narrow by `entity_id` and/or `friendly_name` early.
- Confirm `_field` choices before aggregation due to mixed field naming.

### IotaWatt

- `_field` is usually `value`.
- Use `_measurement` for circuit/channel selection.
- Use `unit` tag as a guardrail (`Watts` for power, `Wh` for energy, etc.).

## Timezone Guidance

Use UTC for raw storage semantics, but apply `Australia/Sydney` for user-facing daily/hourly grouping and reporting periods where appropriate.

For daily windows, be explicit and note timezone assumptions in results.

## Query Construction Rules

- Always constrain `range()` tightly first, then widen as needed.
- Filter by `_measurement` early.
- Filter by relevant tags before aggregation.
- Use `aggregateWindow()` for rollups (e.g. `1m`, `15m`, `1h`, `1d`).
- Use `createEmpty: false` unless gaps are explicitly needed.
- Prefer incremental exploration over monolithic queries.

## Output Expectations

When answering user questions:

1. Briefly state assumptions (bucket, measurement, field, time range, timezone).
2. Provide the Flux query used.
3. Summarize findings in plain language.
4. If schema uncertainty remains, show what was discovered and ask a targeted follow-up.

## Troubleshooting

- If auth fails: confirm token, org, and URL alignment.
- If no rows: verify bucket name, retention period, and time range.
- If schema funcs are empty: increase `start` window (e.g. `-365d`).
- If cardinality is high: narrow by measurement and shorter `range()` first.

## Home Assistant + IotaWatt Focus

Assume two primary buckets exist:

- `homeassistant`
- `iotawatt`

Use the known dataset shape above as a starting point, but verify with schema queries before making strict assumptions in user-facing analysis.
