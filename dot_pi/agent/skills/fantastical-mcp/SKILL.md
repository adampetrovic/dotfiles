---
name: fantastical-mcp
description: Query and manage Fantastical calendars, events, tasks, and availability through Fantastical's bundled local MCP server. Use when the user asks about their schedule, calendars, calendar sets, free time, events, or tasks, or asks to create, reschedule, rename, relocate, or delete a Fantastical item.
compatibility: Requires Fantastical 4.1.17+ in /Applications and Node.js 20+.
---

# Fantastical MCP

Use Fantastical's bundled MCP server through the dependency-free client in this skill. No general MCP adapter is required.

Resolve relative paths from this skill directory:

```bash
./scripts/fantastical-mcp-client.mjs doctor
./scripts/fantastical-mcp-client.mjs list-tool-names
./scripts/fantastical-mcp-client.mjs describe-tool <tool-name>
./scripts/fantastical-mcp-client.mjs call-tool <tool-name> '<json-arguments>'
```

Set `FANTASTICAL_MCP_COMMAND` only if Fantastical is installed somewhere other than `/Applications/Fantastical.app`.

## Safety

Read-only tools may be called when needed:

- `queryCalendars`
- `queryCalendarSets`
- `queryCalendarItems`
- `findAvailableTimes`

Mutating tools require `--confirm`, and the flag is enforced by the client:

- `createCalendarItem`
- `modifyCalendarItem`
- `deleteCalendarItem`

Only pass `--confirm` when the user clearly requested the exact create or modification being performed. Always obtain fresh explicit confirmation immediately before deletion. If a create or modification would conflict with another calendar item, ask the user before proceeding. Never invent an item ID: retrieve it with `queryCalendarItems` unless it was returned earlier in the same task.

Before a mutation, state the item, date, time, calendar when known, and action clearly enough for the user to catch mistakes. Use concrete dates including the year when natural-language dates could be ambiguous.

## Tool reference

Schemas can change when Fantastical updates. Run `describe-tool` before an unfamiliar or failed call.

### List calendars

```bash
./scripts/fantastical-mcp-client.mjs call-tool queryCalendars '{}'
```

### List calendar sets

```bash
./scripts/fantastical-mcp-client.mjs call-tool queryCalendarSets '{}'
```

### Search events and tasks

All arguments are optional. `calendarId` and `calendarSetId` are mutually exclusive.

```bash
./scripts/fantastical-mcp-client.mjs call-tool queryCalendarItems '{"query":"planning","when":"September 23 to September 30 2026"}'
./scripts/fantastical-mcp-client.mjs call-tool queryCalendarItems '{"when":"September 23 2026"}'
```

Arguments: `query`, `when`, `calendarId`, `calendarSetId`.

### Find available times

`durationMinutes` is required and must be positive. Each `...CalendarId` argument is mutually exclusive with its corresponding `...CalendarSetId` argument.

```bash
./scripts/fantastical-mcp-client.mjs call-tool findAvailableTimes '{"durationMinutes":60,"title":"Planning","when":"next week"}'
```

Arguments: `durationMinutes`, `title`, `when`, `conflictCalendarId`, `conflictCalendarSetId`, `historyCalendarId`, `historyCalendarSetId`.

Present two or three natural choices from `suggestedTimes`, favoring earlier entries. Use `openTimes` only as fallback. Do not expose scores, rankings, internal patterns, search mechanics, or phrases such as “top slot.” Apply judgment to avoid proposing unreasonable hours.

### Create an event or task

`description` is required. Keep it compact and parser-friendly. `type` may be `event` or `task`; omit it when Fantastical should infer the type.

```bash
./scripts/fantastical-mcp-client.mjs call-tool createCalendarItem '{"description":"Lunch with Ronald 1pm tomorrow alarm 12:30pm","type":"event","location":"Cafe"}' --confirm
```

Arguments: `description`, `calendarId`, `location`, `type`.

### Modify an event or task

Search first to obtain the exact ID. `id` is required, plus at least one of `title`, `when`, or `location`. An empty `location` removes the location.

```bash
./scripts/fantastical-mcp-client.mjs call-tool modifyCalendarItem '{"id":"ITEM_ID","when":"September 25 2026 at 3pm"}' --confirm
```

### Delete an event or task

Search first to obtain the exact ID, show the matched item to the user, and always ask for explicit confirmation.

```bash
./scripts/fantastical-mcp-client.mjs call-tool deleteCalendarItem '{"id":"ITEM_ID"}' --confirm
```

## Troubleshooting

- Run `doctor` to verify the executable, MCP handshake, and discovered tools.
- Run `list-tool-names` or `describe-tool` after Fantastical upgrades.
- If the executable moved, set `FANTASTICAL_MCP_COMMAND` to its absolute path.
- If a request times out, override `FANTASTICAL_MCP_TIMEOUT` in milliseconds.
- Fantastical may log that the launching process has no resolvable code signature; this is informational when the MCP handshake and calls still succeed.
