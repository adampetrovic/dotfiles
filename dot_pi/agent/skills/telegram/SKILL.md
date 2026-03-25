---
name: telegram
description: Read, search, and send Telegram messages via a Telethon-based CLI. Use when the user asks about Telegram messages, chats, contacts, groups, channels, or wants to send/search/read Telegram content.
---

# Telegram

## Setup

Requires a one-time interactive login. The user must run this in their terminal:

```bash
/Users/adam/.pi/agent/skills/telegram/scripts/tg.sh login
```

This prompts for:
1. API credentials from https://my.telegram.org/apps (api_id + api_hash) — only on first run
2. Phone number and verification code from Telegram

Credentials are stored in `~/.config/telegram-cli/credentials` (mode 600). Session in `~/.config/telegram-cli/session.session`.

## CLI

All commands return JSON on stdout: `{ ok, data }` on success, `{ ok, error }` on failure.

```bash
TG="/Users/adam/.pi/agent/skills/telegram/scripts/tg.sh"
```

### Identity

```bash
$TG me                        # Current user info
$TG info @username            # Detailed info about user/group/channel
$TG info 123456789            # By numeric ID
```

### Listing Chats

```bash
$TG chats list                          # Recent conversations (default: 40)
$TG chats list --limit 10 --unread      # Only unread chats
$TG chats list --type user              # Filter: user, bot, group, channel
$TG chats list --archived               # Include archived chats
```

### Searching Chats

```bash
$TG chats search "query"                # Search your chats by name
$TG chats search "query" --limit 10     # Limit results
```

### Reading Messages

```bash
$TG msg list @username --limit 10               # Recent messages from a chat
$TG msg list @username --since 1711234567       # Messages after unix timestamp
$TG msg list @username --from @sender           # Filter by sender
$TG msg list @username --query "keyword"        # Filter by text content
$TG msg get @username 12345                     # Get a single message by ID
```

Paginate with `--offset-id` using `nextOffset` from the previous response.

### Searching Messages

```bash
$TG msg search "keyword"                        # Search across all chats
$TG msg search "keyword" --chat @username       # Search within specific chat
$TG msg search "keyword" --since 1711234567     # After unix timestamp
$TG msg search "keyword" --until 1711320967     # Before unix timestamp
$TG msg search "keyword" --full                 # Untruncated message text
```

Paginate with `--offset-id` via `nextOffset`. Text is truncated to 500 chars by default; use `--full` when content matters.

### Sending Messages

```bash
$TG send @username "Hello!"                     # Plain text
$TG send @username "<b>bold</b>" --html         # HTML formatting
$TG send @username "**bold**" --md              # Markdown formatting
$TG send @username "quiet" --silent             # No notification
$TG send @username "reply" --reply-to 12345     # Reply to message
echo "long text" | $TG send @username --stdin   # Pipe from stdin
```

### Media

```bash
$TG download @chat 12345                        # Download to cwd
$TG download @chat 12345 --output ./pic.jpg     # Custom output path
```

### Entity Resolution

Chats/users can be referenced by: numeric ID, `@username`, phone number, or `t.me/link`.

## Rules

1. **Confirm before sending** — always show the user what will be sent and to whom before executing send actions.
2. **Reads don't need confirmation** — listing chats, reading messages, and searching are safe to do freely.
3. **Use search first** — when the user refers to a chat by name, use `chats search` to find the correct entity before reading messages.
4. **Paginate for completeness** — if the user wants all messages or comprehensive results, use `--offset-id` with `nextOffset`.
5. **Prefer --since for recent messages** — convert relative times ("last hour", "today") to unix timestamps using `date`.
6. **Use --full for search** — message text is truncated to 500 chars by default in search results.

## Stack

- **Telethon** v1.42 — MIT license, 12k GitHub stars, pure Python, auditable source
- **Python venv** at `/Users/adam/.pi/agent/skills/telegram/.venv/`
- No precompiled binaries, no telemetry, no third-party services
