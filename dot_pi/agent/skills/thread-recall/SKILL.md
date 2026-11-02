---
name: thread-recall
description: Search, read, and summarise past coding-agent sessions (pi, claude-code, codex) using Atuin's captured threads. Use when asked to find a previous session or discussion, recall what was decided or tried before, summarise what was done over a period, or resume or fork earlier work.
---

# thread-recall

Atuin captures agent sessions as threads. Shell history (`atuin search`) holds only commands, not prompts. Use `atuin threads` for anything said to an agent.

## Commands

```bash
atuin threads search <words...> --harness pi --limit 10 --style plain   # all words must appear; quote a phrase to match it in order
atuin threads list --style plain            # newest first, no filter flags
atuin threads list --style ndjson           # fields: updated_at, started_at, cwd, message_count, title, preview, parent_kind
atuin threads show <id|latest> --style plain
atuin threads show <id> --style ndjson      # one record per message
atuin threads resume                        # interactive picker; do not run from an agent
```

Search is full-text over titles, message text, reasoning and tool calls. It is not semantic.

## Workflow

1. Search with 2-3 distinctive terms (identifiers, ticket keys, tool names, error strings). Try synonyms and quoted phrases if there are no hits.
2. Prefer `--style plain` for scanning and `ndjson` for filtering with `python3` or `jq`. Never print a whole thread. Filter to the user and assistant messages near the match.
3. A match inside a huge thread (thousands of messages) is usually in a fork. Check `parent_kind` and `parent_atuin_id` and pick the fork that contains the match.
4. Matches may include this session, or earlier recall sessions that quote the query. Skip threads whose title or preview is itself a recall request.
5. Report the thread id, date and cwd with the finding, so the user can run `atuin threads resume`.

## Period summaries

Filter `list --style ndjson` by `updated_at` in Python, then read the user messages of each thread in range. Group by `cwd` and title. Summarise outcomes (PRs, tickets, decisions), not the conversation.

## Limits

- Only sessions captured since threads were enabled, plus anything from `atuin threads import`.
- Harnesses: claude-code, codex, opencode, pi, omp.
