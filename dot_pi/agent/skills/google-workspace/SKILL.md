---
name: google-workspace
description: "Interact with Google Workspace (Drive, Gmail, Calendar, Sheets, Docs, Tasks, Chat, Meet) via the `gws` CLI. Use when the user asks about Google Drive files, sending/reading email, calendar events, spreadsheets, documents, tasks, or any Google Workspace operation."
---

# Google Workspace — `gws` CLI

`gws` is a unified CLI for all Google Workspace APIs. **Prefer `+helper` commands** for common tasks — they handle pagination, formatting, encoding, and threading automatically. Fall back to the raw API (`gws <service> <resource> <method>`) for advanced or uncommon operations.

## Authentication

```bash
gws auth status                                    # check current auth
gws auth login -s drive,gmail,calendar,sheets,tasks # login with specific scopes
gws auth list                                       # list accounts
gws auth default work@company.com                   # switch default account
gws --account personal@gmail.com gmail +triage      # one-off account override
```

> **Scope limit:** Unverified OAuth apps are limited to ~25 scopes. Always use `-s service1,service2` to select only what you need.

## Helpers (Preferred)

Helpers are high-level commands prefixed with `+`. They batch API calls, handle encoding, and produce clean output. **Always use these first.**

### Gmail Helpers

```bash
# Triage — list emails with sender, subject, date in one call
gws gmail +triage                                         # unread inbox (default)
gws gmail +triage --query 'after:2026/03/18'              # today's emails
gws gmail +triage --query 'from:boss is:unread' --max 5   # filtered
gws gmail +triage --format table                          # table output
gws gmail +triage --labels                                # include label names

# Send — no base64 encoding needed
gws gmail +send --to alice@example.com --subject 'Hello' --body 'Hi Alice!'
gws gmail +send --to alice@example.com --subject 'Report' --body '<b>See attached</b>' --html
gws gmail +send --to a@x.com --cc b@x.com --bcc c@x.com --subject 'FYI' --body 'Note'

# Reply — auto-sets In-Reply-To, References, threadId, quotes original
gws gmail +reply --message-id MSG_ID --body 'Thanks, got it!'
gws gmail +reply --message-id MSG_ID --body 'Looping in Carol' --cc carol@example.com

# Reply All — replies to sender + all To/CC recipients
gws gmail +reply-all --message-id MSG_ID --body 'Sounds good!'
gws gmail +reply-all --message-id MSG_ID --body 'Updated' --remove bob@example.com

# Forward
gws gmail +forward --message-id MSG_ID --to dave@example.com
gws gmail +forward --message-id MSG_ID --to dave@example.com --body 'FYI see below'

# Watch — stream new emails as NDJSON (requires GCP Pub/Sub)
gws gmail +watch --project my-gcp-project --label-ids INBOX --once
```

### Calendar Helpers

```bash
# Agenda — upcoming events across all calendars in one call
gws calendar +agenda                                      # next 7 days (default)
gws calendar +agenda --today                              # today only
gws calendar +agenda --tomorrow                           # tomorrow only
gws calendar +agenda --week                               # this week
gws calendar +agenda --days 3                             # next 3 days
gws calendar +agenda --today --format table               # table output
gws calendar +agenda --calendar 'Work'                    # specific calendar
gws calendar +agenda --today --timezone America/New_York  # timezone override

# Insert — create an event
gws calendar +insert --summary 'Standup' \
  --start '2026-03-20T09:00:00+11:00' \
  --end '2026-03-20T09:30:00+11:00'

gws calendar +insert --summary 'Review' \
  --start '2026-03-20T14:00:00+11:00' \
  --end '2026-03-20T15:00:00+11:00' \
  --attendee alice@example.com --meet   # adds Google Meet link
```

### Drive Helpers

```bash
# Upload — auto-detects MIME type and filename
gws drive +upload ./report.pdf
gws drive +upload ./report.pdf --parent FOLDER_ID
gws drive +upload ./data.csv --name 'Sales Data.csv'
```

### Sheets Helpers

```bash
# Read — fetch cell values
gws sheets +read --spreadsheet SHEET_ID --range 'Sheet1!A1:D10'
gws sheets +read --spreadsheet SHEET_ID --range Sheet1

# Append — add rows
gws sheets +append --spreadsheet SHEET_ID --values 'Alice,100,true'
gws sheets +append --spreadsheet SHEET_ID --json-values '[["a","b"],["c","d"]]'
```

### Docs Helpers

```bash
# Write — append text to end of document
gws docs +write --document DOC_ID --text 'Hello, world!'
```

## Raw API (Fallback)

Use the raw API when helpers don't cover the operation (e.g., deleting, modifying labels, downloading files, complex queries).

### Syntax

```bash
gws <service> <resource> [sub-resource] <method> [flags]
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Validate locally without calling the API |
| `--format <FMT>` | Output: `json` (default), `table`, `yaml`, `csv` |
| `--page-all` | Auto-paginate (NDJSON, one JSON object per line) |
| `--page-limit <N>` | Max pages (default: 10) |
| `--account <EMAIL>` | Override the active account for this command |
| `--params '{"k":"v"}'` | URL/query parameters |
| `--json '{"k":"v"}'` | Request body (JSON) |
| `-o, --output <PATH>` | Save binary response to file |
| `--upload <PATH>` | Upload file content (multipart) |

### Discovering APIs

**Always discover before guessing.** The CLI is self-documenting:

```bash
gws drive --help                    # list resources & methods
gws schema drive.files.list         # inspect parameters & response schema
gws schema gmail.users.messages.get # see field types and descriptions
```

### Gmail (Raw)

```bash
# Read a specific message (full content)
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID", "format": "full"}'

# Search messages
gws gmail users messages list --params '{"userId": "me", "q": "from:boss is:unread", "maxResults": 10}'

# List labels
gws gmail users labels list --params '{"userId": "me"}'

# Modify labels on a message
gws gmail users messages modify --params '{"userId": "me", "id": "MSG_ID"}' \
  --json '{"addLabelIds": ["STARRED"], "removeLabelIds": ["UNREAD"]}'

# Trash / untrash
gws gmail users messages trash --params '{"userId": "me", "id": "MSG_ID"}'
gws gmail users messages untrash --params '{"userId": "me", "id": "MSG_ID"}'
```

### Calendar (Raw)

```bash
# List upcoming events (manual query)
gws calendar events list --params '{"calendarId": "primary", "timeMin": "2026-03-18T00:00:00Z", "maxResults": 10, "singleEvents": true, "orderBy": "startTime"}'

# Get event details
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'

# Delete an event
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'

# List calendars
gws calendar calendarList list

# Check free/busy
gws calendar freebusy query --json '{
  "timeMin": "2026-03-18T00:00:00Z",
  "timeMax": "2026-03-18T23:59:59Z",
  "items": [{"id": "primary"}]
}'
```

### Drive (Raw)

```bash
# List files
gws drive files list --params '{"pageSize": 10}'

# Search files
gws drive files list --params '{"q": "name contains '\''budget'\''", "pageSize": 10}'

# Get file metadata
gws drive files get --params '{"fileId": "FILE_ID", "fields": "id,name,mimeType,size,modifiedTime"}'

# Download a file
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o ./file.pdf

# Export Google Doc as PDF
gws drive files export --params '{"fileId": "FILE_ID", "mimeType": "application/pdf"}' -o ./doc.pdf

# Create a folder
gws drive files create --json '{"name": "New Folder", "mimeType": "application/vnd.google-apps.folder"}'

# List all files, auto-paginate
gws drive files list --params '{"pageSize": 100}' --page-all | jq -r '.files[].name'
```

### Sheets (Raw)

**Important:** Sheets ranges use `!` which bash interprets as history expansion. Always use **single quotes**.

```bash
# Write cells
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95], ["Bob", 87]]}'

# Create a spreadsheet
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'

# Get spreadsheet metadata
gws sheets spreadsheets get --params '{"spreadsheetId": "SHEET_ID", "fields": "sheets.properties"}'
```

### Docs (Raw)

```bash
# Get document content
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Create a document
gws docs documents create --json '{"title": "Meeting Notes"}'

# Insert text at a position
gws docs documents batchUpdate --params '{"documentId": "DOC_ID"}' \
  --json '{"requests": [{"insertText": {"location": {"index": 1}, "text": "Hello World\n"}}]}'
```

### Tasks (Raw)

```bash
gws tasks tasklists list
gws tasks tasks list --params '{"tasklist": "TASKLIST_ID"}'
gws tasks tasks insert --params '{"tasklist": "TASKLIST_ID"}' --json '{"title": "Review PR", "due": "2026-03-20T00:00:00Z"}'
gws tasks tasks update --params '{"tasklist": "TASKLIST_ID", "task": "TASK_ID"}' --json '{"status": "completed"}'
```

### Chat (Raw)

```bash
gws chat spaces list
gws chat spaces messages create --params '{"parent": "spaces/SPACE_ID"}' --json '{"text": "Deploy complete."}'
```

## Rules

1. **Use helpers first** — `+triage`, `+agenda`, `+send`, `+reply`, `+upload`, etc. are faster and handle encoding/pagination automatically. Fall back to raw API only when needed.
2. **Discover before guessing** — run `gws <service> --help` and `gws schema <method>` before constructing raw API calls.
3. **Confirm before mutating** — show the user the command (or use `--dry-run`) before any create/update/delete. Read operations don't need confirmation.
4. **Verify after acting** — fetch the resource after a write to confirm it took effect.
5. **Use `--page-all` for bulk reads** — pipe to `jq` for filtering large result sets.
6. **Never output tokens or secrets** — don't echo `GOOGLE_WORKSPACE_CLI_TOKEN` or credential file contents.
7. **Single-quote Sheets ranges** — the `!` in `Sheet1!A1` triggers bash history expansion in double quotes.
8. **Use `--format table`** for human-readable output when displaying results to the user.
