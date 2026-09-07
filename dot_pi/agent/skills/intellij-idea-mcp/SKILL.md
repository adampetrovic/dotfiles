---
name: intellij-idea-mcp
description: Interact directly with the local JetBrains IntelliJ IDEA MCP Server over SSE. Use when the user asks to query IDEA project context, list/run configurations, build or inspect project modules, search symbols using IDE indexes, run inspections, reformat/open files in IDEA, execute IDE terminal commands, use debugger tools, or test/troubleshoot IDEA MCP connectivity.
compatibility: Requires IntelliJ IDEA 2025.2+ or compatible JetBrains IDE with bundled MCP Server enabled, Node.js 20+, and local network access to the IDE MCP SSE URL, usually http://127.0.0.1:64342/sse.
---

# IntelliJ IDEA MCP

Use this skill when the user wants Pi to interact with IntelliJ IDEA's local MCP Server directly.

Default local endpoint:

```text
http://127.0.0.1:64342/sse
```

Override with `IDEA_MCP_URL` if IDEA shows a different URL:

```bash
IDEA_MCP_URL=http://127.0.0.1:64342/sse ./scripts/idea-mcp-client.mjs doctor
```

## Safety

- Treat these tools as IDE actions, not just file reads. Ask before destructive or broad mutations.
- Safe read-only calls include: `get_project_modules`, `get_project_dependencies`, `get_run_configurations`, `get_all_open_file_paths`, `read_file`, `search_file`, `search_regex`, `search_symbol`, `search_text`, `get_symbol_info`, `get_file_problems`, `lint_files`, `git_status`, and database list/describe tools.
- Ask for explicit confirmation before calling mutating/executing tools unless the user clearly requested that exact action: `apply_patch`, `create_new_file`, `rename_refactoring`, `reformat_file`, `build_project`, `execute_run_configuration`, `execute_terminal_command`, debugger breakpoint/session/variable tools, and database connection/query tools.
- Always pass `projectPath` when known. For this TDP-OS checkout, use `/Users/apetrovic/code/tdp-os`.
- Prefer IDEA MCP semantic/indexed tools over ad hoc grep when the user asks about symbols, run configurations, inspections, modules, or IDE state.

## Helper commands

Resolve relative paths from this skill directory.

```bash
./scripts/idea-mcp-client.mjs doctor
./scripts/idea-mcp-client.mjs server-info
./scripts/idea-mcp-client.mjs list-tools
./scripts/idea-mcp-client.mjs list-tool-names
./scripts/idea-mcp-client.mjs describe-tool search_symbol
./scripts/idea-mcp-client.mjs call-tool get_project_modules '{"projectPath":"/Users/apetrovic/code/tdp-os"}'
./scripts/idea-mcp-client.mjs call-tool search_symbol '{"q":"SomeClass","projectPath":"/Users/apetrovic/code/tdp-os"}'
./scripts/idea-mcp-client.mjs call-tool get_file_problems '{"filePath":"tdp-os/src/main/kotlin/example/File.kt","errorsOnly":true,"projectPath":"/Users/apetrovic/code/tdp-os"}'
```

## Common workflows

### Connectivity test

```bash
./scripts/idea-mcp-client.mjs doctor
```

A healthy server reports the server name/version and tool count.

### Discover available tools

```bash
./scripts/idea-mcp-client.mjs list-tool-names
./scripts/idea-mcp-client.mjs describe-tool get_project_modules
```

### Call an IDEA MCP tool

```bash
./scripts/idea-mcp-client.mjs call-tool <tool-name> '<json-arguments>'
```

Examples:

```bash
./scripts/idea-mcp-client.mjs call-tool get_project_modules '{"projectPath":"/Users/apetrovic/code/tdp-os"}'
./scripts/idea-mcp-client.mjs call-tool get_run_configurations '{"projectPath":"/Users/apetrovic/code/tdp-os"}'
./scripts/idea-mcp-client.mjs call-tool search_symbol '{"q":"Partition","limit":20,"projectPath":"/Users/apetrovic/code/tdp-os"}'
./scripts/idea-mcp-client.mjs call-tool lint_files '{"files":["tdp-os/src/main/kotlin/path/File.kt"],"min_severity":"WARNING","timeout":60000,"projectPath":"/Users/apetrovic/code/tdp-os"}'
```

## Known tool families observed in IDEA 2026.2.2

- Project/build/run: `get_project_modules`, `get_project_dependencies`, `build_project`, `get_run_configurations`, `execute_run_configuration`
- IDE files/search: `read_file`, `create_new_file`, `apply_patch`, `search_file`, `search_text`, `search_regex`, `search_symbol`, `get_symbol_info`, `open_file_in_editor`, `get_all_open_file_paths`, `list_directory_tree`, `reformat_file`
- Inspections: `get_file_problems`, `lint_files`
- Refactoring: `rename_refactoring`
- Call hierarchy: `analyze_calls`
- Terminal/VCS: `execute_terminal_command`, `get_repositories`, `git_status`
- Debugger: `xdebug_*`
- Database: `list_database_connections`, `test_database_connection`, `execute_sql_query`, `fetch_query_result`, schema/object inspection tools

Tool schemas can change between IDEA versions. Use `describe-tool` before unfamiliar calls.

## Troubleshooting

- If `/api/mcp` returns 404, use the exact SSE endpoint from IDEA settings, usually `/sse` on port `64342`, not the built-in web server port `63342`.
- If `doctor` times out, confirm **Settings → Tools → MCP Server** is enabled and copy the current URL.
- If the port changed, set `IDEA_MCP_URL`.
- If calls are ambiguous, include `projectPath`.
