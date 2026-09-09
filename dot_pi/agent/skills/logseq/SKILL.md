---
name: logseq
description: Query and manage Logseq DB graphs with the official Logseq CLI. Use for Logseq pages, blocks, journals, tasks, searches, graph queries, and saving Pi session notes.
---

# Logseq CLI Skill

Use the official `logseq` CLI against Logseq DB graphs. The CLI talks to Logseq's DB worker; it does not require the desktop HTTP API or `LOGSEQ_API_SERVER_TOKEN`.

## Start Here

Check the installation and available graphs:

```bash
logseq doctor
logseq graph list -o json
```

Select the requested graph explicitly with `-g`. If there is only one graph, use it. If several graphs exist and the target is unclear, ask the user.

```bash
GRAPH="fy27-notes"
logseq -g "$GRAPH" graph info -o json
```

Prefer `-o json` for parsing. Run `logseq <command> --help` or `logseq example` before using an unfamiliar mutation.

## Read and Search

```bash
# Search pages and blocks
logseq -g "$GRAPH" search page --content "incident" -o json
logseq -g "$GRAPH" search block --content "BLOB-4260" -o json

# Show a page or block tree
logseq -g "$GRAPH" show --page "Project Notes" --level 3 -o json
logseq -g "$GRAPH" show --id 123 --level 3 -o json
logseq -g "$GRAPH" show --uuid 11111111-1111-1111-1111-111111111111 -o json

# Include page hierarchy or linked references when useful
logseq -g "$GRAPH" show --page "Project Notes" --page-hierarchy true --linked-references true -o json

# List tasks
logseq -g "$GRAPH" list task --status todo --limit 100 -o json
logseq -g "$GRAPH" list task --content "release" --sort updated-at --order desc -o json
```

For structured or relationship-heavy retrieval, use Datascript:

```bash
logseq -g "$GRAPH" query --query '[:find [?e ...] :where [?e :block/name]]' -o json
logseq -g "$GRAPH" query --name recent-updated --inputs '[30]' -o json
logseq -g "$GRAPH" query list -o json
```

## Pages and Blocks

Create or update a page, then add content to it:

```bash
logseq -g "$GRAPH" upsert page --page "Pi Agent/Example" --update-tags '["pi-agent"]' -o json
logseq -g "$GRAPH" upsert block --target-page "Pi Agent/Example" --pos last-child --content "Summary text" -o json
```

Update an existing block using its stable ID or UUID:

```bash
logseq -g "$GRAPH" upsert block --id 123 --content "Updated text" -o json
logseq -g "$GRAPH" upsert block --uuid "$UUID" --content "Updated text" -o json
```

For several nested blocks, write EDN to a temporary file and use `--blocks-file` rather than fighting shell quoting:

```bash
logseq -g "$GRAPH" upsert block --target-page "Pi Agent/Example" --pos last-child --blocks-file /tmp/logseq-blocks.edn -o json
```

Inspect the resulting page or returned IDs after every write.

## Tasks

```bash
# Create
logseq -g "$GRAPH" upsert task \
  --target-page "Weekly Plan" \
  --content "Ship release" \
  --status todo \
  --priority high \
  -o json

# Update by stable ID
logseq -g "$GRAPH" upsert task --id 123 --status doing -o json

# Remove selected task fields
logseq -g "$GRAPH" upsert task --id 123 --no-priority --no-deadline -o json
```

Use ISO timestamps for `--scheduled` and `--deadline`.

## Journals

Target journals deterministically; do not rely on whichever page is open in Logseq.

Convert the Sydney-local date to `YYYYMMDD`, then find the journal page:

```bash
DAY="20260916"
logseq -g "$GRAPH" query \
  --query "[:find (pull ?p [*]) :where [?p :block/journal-day $DAY]]" \
  -o json
```

Use the returned page name or ID as the `upsert block` target. Create a parent block first when adding a structured entry, then add children with `--target-id <id> --pos last-child`. Verify the inserted IDs with `show` or a query.

## Saving a Pi Session

When asked to save or summarise the current Pi session:

1. Summarise the conversation directly; do not call a second model.
2. Use a concise title under the `Pi Agent/` namespace.
3. Create or update that page with `upsert page` and `upsert block`.
4. Add a concise entry to today's journal linking to `[[Pi Agent/<Title>]]`.
5. Search the journal first to avoid duplicate links.
6. Verify both the page and journal entry after writing.

Write Logseq-native blocks, not Markdown files. Keep the structure relatively flat, use complete sentences and Australian English, and avoid Markdown headings inside blocks.

## Mutation Safety

- Inspect before mutating and verify afterwards.
- Prefer stable IDs or UUIDs when updating existing entities.
- Search for an existing page/block before creating a duplicate.
- Ask for confirmation before deleting pages, deleting multiple blocks, restoring backups, importing graphs, or performing broad updates.
- Never infer the target graph when multiple graphs exist.
- Do not edit Logseq's DB files directly.

Deletion commands, only after confirmation:

```bash
logseq -g "$GRAPH" remove block --id 123 -o json
logseq -g "$GRAPH" remove page --page "Old Page" -o json
```

## Troubleshooting

```bash
logseq doctor
logseq server list
logseq server restart -g "$GRAPH"
logseq graph validate -g "$GRAPH"
```

If a command's shape has changed, trust the installed CLI help:

```bash
logseq --help
logseq <command> --help
logseq example
```
