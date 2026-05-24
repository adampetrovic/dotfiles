---
name: logseq
description: Use the official Logseq CLI and local HTTP API server to query, search, and append to the currently open Logseq graph. Use for Logseq pages, blocks, tasks, graph queries, and Pi Agent notes.
---

# Logseq CLI Skill

Use the **official Logseq CLI** (`@logseq/cli`) against the locally running Logseq desktop HTTP API server.

## Current Setup

- Logseq stable desktop: `0.10.15`
- Official CLI: `@logseq/cli@0.4.3`
- API server: `http://127.0.0.1:12315/api`
- Token is stored in Logseq settings and must be available as `LOGSEQ_API_SERVER_TOKEN`.
- The CLI requires Node `>=22.17.0`; in pi sessions use `mise exec node@22 -- ...` if `node` resolves to v20.

Check availability:

```bash
mise exec node@22 -- logseq -v
curl -s -i http://127.0.0.1:12315/ | head
```

## Preferred Commands

### Query current graph

Use official CLI query for reads/tasks/Datalog:

```bash
mise exec node@22 -- logseq query '(task TODO)'
mise exec node@22 -- logseq query '(task DOING)'
mise exec node@22 -- logseq query '[:find (pull ?b [*]) :where [?b :block/marker "TODO"]]'
```

`logseq query` automatically uses `$LOGSEQ_API_SERVER_TOKEN` when set. You can also pass `-a "$LOGSEQ_API_SERVER_TOKEN"` explicitly.

### Append to current page

Use official CLI append for simple additions to the page currently open in Logseq:

```bash
mise exec node@22 -- logseq append "Text to append"
```

### Search current graph

Do **not** use `logseq search` on stable `0.10.15` directly. The released CLI expects API search blocks to contain `title`, but stable returns `block/content`, causing:

```text
Cannot read properties of null (reading 'replace')
```

Use the bundled workaround instead:

```bash
node ~/.pi/agent/skills/logseq/scripts/logseq-search.mjs --limit 20 "Pi Agent"
node ~/.pi/agent/skills/logseq/scripts/logseq-search.mjs --json "search terms"
```

The workaround calls the same official Logseq API method (`logseq.app.search`) and normalizes stable response fields.

## Official CLI Help

```bash
mise exec node@22 -- logseq -h
mise exec node@22 -- logseq query -h
mise exec node@22 -- logseq append -h
mise exec node@22 -- logseq export-edn -h
mise exec node@22 -- logseq import-edn -h
```

Useful API-mode commands:

```bash
mise exec node@22 -- logseq query '(task TODO)'
mise exec node@22 -- logseq append "note text"
mise exec node@22 -- logseq export-edn -f /tmp/logseq-export.edn
mise exec node@22 -- logseq import-edn -f /path/to/file.edn
mise exec node@22 -- logseq mcp-server
```

## Pi Agent Page Namespace

All pages created by pi-agent **must** live under the `Pi Agent/` namespace. This keeps agent-generated content grouped under the `[[Pi Agent]]` parent page.

Rules:

- Page titles: always prefix with `Pi Agent/`, e.g. `Pi Agent/Coffee Switch OTA Failure`
- Filenames for manual file writes: use `Pi Agent___`, e.g. `pages/Pi Agent___Coffee Switch OTA Failure.md`
- Journal links: use the full namespaced title, e.g. `[[Pi Agent/My Page Title]]`

## Writing Format for Pi Agent Pages

Follow the flat narrative style used by `[[Pi Agent/Financial Advisor Meeting Narrative]]`.

Rules:

- Use Logseq page properties at the top: `tags::`, `date::` or `created::`, `source::` when relevant.
- Do **not** add a markdown H1/H2/H3 heading inside the page body.
- Do **not** use sections like `## Summary` or `# Title`.
- Structure content as a flat set of top-level bullets with bolded labels, for example `- **Purpose**: ...`.
- Use nested bullets only for details under a bolded top-level label.
- Prefer narrative prose over report-style headings.

Manual page file example:

```markdown
<!-- File: pages/Pi Agent___My New Page.md -->
tags:: pi-agent
created:: 2026-05-14
source:: [[Pi Agent]]
- **Purpose**: Briefly explain why this page exists.
- **Context**:
  - Supporting detail goes here.
  - Another supporting detail goes here.
- **Outcome**: Summarise the decision, result, or next step.
```

## When to Use File Writes Instead

The released official CLI is limited on stable Logseq. Continue using direct file writes for:

- Creating structured `Pi Agent/...` pages
- Large multi-block documents
- Precise edits to existing Markdown files
- Cases where the current open page is not the desired append target

After direct file writes, Logseq will pick up the file changes from the graph directory.

## Troubleshooting

### API auth failure

Ensure the token exists and is exported:

```bash
export LOGSEQ_API_SERVER_TOKEN='...'
```

### API server not reachable

In Logseq desktop, enable **Settings → Features → HTTP API server**.

### Search crashes

Expected on stable if using `logseq search`. Use:

```bash
node ~/.pi/agent/skills/logseq/scripts/logseq-search.mjs "terms"
```

### Nightly note

Logseq nightly `2.0.1-alpha` returns a newer search shape where official `logseq search` works, but it is DB-graph alpha software. Stay on stable for the main graph unless explicitly testing on a copy.
