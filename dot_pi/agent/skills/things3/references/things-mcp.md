# Things 3 MCP reference

Pi does not include built-in MCP support, so this Pi skill uses local URL-scheme helper scripts for direct create/show operations.

For a full MCP client, the most popular Things 3 MCP server found during research was:

- `hald/things-mcp` — https://github.com/hald/things-mcp
- Install/run: `uvx things-mcp`
- Claude Code global config: `claude mcp add-json -s user things '{"command":"uvx","args":["things-mcp"]}'`

Capabilities from the upstream README:

- Read Inbox, Today, Upcoming, Anytime, Someday, Logbook, Trash
- Read projects, areas, tags, tagged items, recent items
- Search todos and advanced filters
- Create/update todos and projects via Things URL scheme
- Bulk updates require the Things URL auth token from Things → Settings → General → Enable Things URLs → Manage

Operational notes:

- Requires macOS and Things 3 installed/opened at least once.
- Requires Things URLs enabled in Things settings for URL-scheme writes.
- Robust reads usually require Full Disk Access/TCC permission to read Things' local database.
- Do not ask the user to paste or reveal the Things auth token. If needed, ask them to configure it locally in the upstream-supported location/tool.
