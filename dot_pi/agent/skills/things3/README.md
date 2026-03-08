# Things3 Manager (Agent skill)

Manage tasks, projects, areas, headings, and tags in the Things3(https://culturedcode.com/things/) macOS app. The agent invokes a local CLI under the hood to list, search, create, or update Things items, or open them in Things.

## What it does
- Lists Inbox/Today/Upcoming/Anytime/Someday/Logbook plus projects, areas, tags, headings.
- Searches by title/notes and supports advanced filters.
- Creates and updates todos/projects via the Things URL scheme.
- Opens lists or items directly in the Things app.

## How it works (agent-driven)
- You ask in natural language (for example: "show my today list" or "add a task to call Alex tomorrow").
- The agent maps the request to read-only commands first, fetches results, and summarizes them.
- For writes (create/update/complete), the agent confirms exact changes before running them.
- The agent can open lists or items in Things via the URL scheme when asked.

## Requirements
- macOS with Things 3 installed and opened at least once.
- In Things -> Settings -> General, enable "Enable Things URLs".

## How to use
Example prompts:
- "Show my Today list"
- "Search for weekly review"
- "List projects in area Business"
- "Add a task: Book flights today, tag travel, checklist passport, charger"
- "Mark send contract with Henric to bank as done"

## Manual CLI (optional)
If installed under a project at `.codex/skills/things3-manager`:
- `bash .codex/skills/things3-manager/scripts/things --help`
- `bash .codex/skills/things3-manager/scripts/things inbox`
- `bash .codex/skills/things3-manager/scripts/things search "weekly review"`
- `bash .codex/skills/things3-manager/scripts/things add-todo --title "Book flights" --when today --tag travel --checklist "passport" --checklist "charger"`

## Where config/state is stored
Skill uses ideas from https://github.com/eugenepyvovarov/skill-boilerplate-skill to store config/data in common location for skills in current project folder.

This skill keeps all mutable state in a deterministic, git-ignorable location under your project root.

- `project_root`: the root of your project/repository (the place you would typically put your `.gitignore`).
- Skill data dir: `<project_root>/.skills-data/things3-manager/`
  - Env file: `.skills-data/things3-manager/.env`
  - Local tools: `.skills-data/things3-manager/bin/` (prepend to `PATH` when needed)
  - Dependencies: `.skills-data/things3-manager/venv/`
  - Logs/cache/tmp: `.skills-data/things3-manager/logs/`, `cache/`, `tmp/`

## Placement
This skill expects to live under `<project_root>/.codex/skills/things3-manager` so it can resolve the host project root and store `.skills-data` alongside the project. If you run it elsewhere, update the `PROJECT_ROOT` logic in `scripts/things` and `scripts/setup.sh`.

## Safety (isolation)
By default, automation lives in `scripts/` and should only write to:
- this repo folder (the skill root), and
- `<project_root>/.skills-data/things3-manager/`

Writes to Things happen via the Things URL scheme in the Things app.

## CLI reference (optional)
- Lists: `inbox`, `today`, `upcoming`, `anytime`, `someday`, `logbook`, `trash`, `recent`
- Browsing: `projects`, `areas`, `tags`, `headings`, `todos`, `tagged-items`
- Search: `search`, `search-advanced`
- Writes: `add-todo`, `add-project`, `update-todo`, `update-project`
- Open: `show`, `search-items`

## Attribution
CLI implementation is based on `things_server.py`, `url_scheme.py`, and `formatters.py` from `https://github.com/hald/things-mcp`.
