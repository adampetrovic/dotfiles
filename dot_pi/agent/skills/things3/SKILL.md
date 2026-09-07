---
name: things3
description: Manage Things 3 tasks on macOS. Use when the user asks to add tasks/projects to Things, turn notes into Things todos, open Things lists, or discuss Things 3 MCP setup. Uses local URL-scheme helper scripts and references hald/things-mcp for full MCP clients.
---

# Things 3

Use this skill for Things 3 task capture and lightweight task/project creation from Pi.

## Safety and permissions

- Do not silently modify Things. For any create/update/delete, state the intended target(s) first unless the user explicitly asked to create them.
- Never ask the user to paste a Things auth token. If an auth token is needed for advanced URL-scheme updates, ask the user to configure it directly in Things/upstream tooling.
- Prefer read-only `doctor`/`show --dry-run` checks when testing.
- Things is local to macOS and may show permission prompts. If a command opens Things or prompts for permission, report that plainly.

## Pi helper

Resolve relative paths from this skill directory.

```bash
./scripts/things3-url.py doctor
./scripts/things3-url.py inbox
./scripts/things3-url.py areas
./scripts/things3-url.py projects
./scripts/things3-url.py list today --limit 10
./scripts/things3-url.py list-area work --limit 10
./scripts/things3-url.py search "insurance"
./scripts/things3-url.py locate "Call dentist"
./scripts/things3-url.py add-todo "Call dentist" --when tomorrow --tag Home
./scripts/things3-url.py add-todo "Review PR" --list work
./scripts/things3-url.py add-project "Trip planning" --area Personal --todo "Book flights" --todo "Check passports"
./scripts/things3-url.py import-json ./payload.json
./scripts/things3-url.py show today
```

Use `--dry-run` to print the `things:///` URL without opening Things:

```bash
./scripts/things3-url.py add-todo "Review PR" --when today --dry-run
```

## Reading todos

Use the helper instead of writing ad hoc AppleScript.

```bash
./scripts/things3-url.py inbox                         # Inbox titles
./scripts/things3-url.py areas                         # Area names, including emoji prefixes
./scripts/things3-url.py projects                      # Project names
./scripts/things3-url.py list today --limit 10          # Built-in list titles
./scripts/things3-url.py list upcoming --limit 20
./scripts/things3-url.py list-area work --limit 10      # Fuzzy-resolves to e.g. 💼 Work
./scripts/things3-url.py search "renewal" --limit 10
./scripts/things3-url.py locate "renewal"              # Show matching item locations
```

Supported built-in lists: `inbox`, `today`, `upcoming`, `anytime`, `someday`, `logbook`, `trash`.

These read commands use Things' AppleScript dictionary and print one title per line. `locate` prints matching titles with their area/project. If richer reads/metadata are needed, use the full MCP option in `references/things-mcp.md`.

## Creating todos

Use `add-todo` for single tasks. For area/project placement, pass `--list`; the helper resolves fuzzy names like `work` to the exact Things area/project name such as `💼 Work`, creates the task, moves it via AppleScript, and prints the verified location.

```bash
./scripts/things3-url.py add-todo "Task title" \
  --notes "Relevant context" \
  --when today \
  --deadline 2026-09-30 \
  --tag Work \
  --list work \
  --checklist "First step" \
  --checklist "Second step"
```

After creating into a non-Inbox list, verify with:

```bash
./scripts/things3-url.py locate "Task title"
./scripts/things3-url.py list-area work
```

Date guidance:

- `--when` is when to work on it: `today`, `tomorrow`, `evening`, `anytime`, `someday`, or `YYYY-MM-DD`.
- `--deadline` is the hard due date: `YYYY-MM-DD`.
- Use the user's timezone/date context. For Adam, interpret dates relative to Australia/Sydney unless explicitly told otherwise.

## Bulk/project import

For multiple tasks or structured projects, write a temporary Things JSON payload and call:

```bash
./scripts/things3-url.py import-json /path/to/payload.json
```

The helper wraps the payload in `things:///json?data=...` and opens it. Keep imports reasonably small; split large task sets.

## Reads and full MCP

Pi has no built-in MCP client, so this skill does not expose live Things database reads as Pi tools. For full read/write MCP integration in clients that support MCP, see `references/things-mcp.md`.

If the user asks to set up full MCP integration, install/use `hald/things-mcp` with `uvx things-mcp` in the target MCP client. For Pi, continue using the helper script unless a Pi MCP extension is installed.
