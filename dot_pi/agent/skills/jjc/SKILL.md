---
name: jjc
description: Non-interactive hunk-level operations for Jujutsu (jj). Use when selectively committing, splitting, dropping, or squashing individual diff hunks by ID in a jj repository.
---

# jjc

Standalone CLI for hunk-level jj operations without interactive prompts.
Reads the jj repository directly via jj-lib. Does not proxy or shell out to `jj`.

## Commands

```bash
# List hunks with changed-lines preview
jjc hunks
jjc hunks --from @-
jjc hunks -r @-

# Full diff with line numbers
jjc hunks --full

# Full diff with blame annotations
jjc hunks --blame

# Inspect a single hunk by ID prefix
jjc hunks a1b
jjc hunks a1b --from @-

# Commit selected hunks into a new commit, leaving the rest in @
jjc pick a1b c3d -m "message"
jjc pick a1b#2 -m "single atom"
jjc pick a1b@10-20 -m "line range"
jjc pick a1b -r @- -m "from another revision"

# Drop hunks (revert to parent content)
jjc drop a1b
jjc drop a1b c3d -r @-

# Squash selected hunks into another revision
jjc fold a1b
jjc fold a1b --into @--
jjc fold --from @- --from @-- --into @--- --select @--:a1b --select @-:c3d
```

## Output format

Default listing shows ID, path, stats, and a changed-lines preview (up to 4 lines):

```
a1b[2c3d4e5f6] src/main.rs (+3 -1)
  +    println!("new");
  -    old_call();
```

`--full` adds context with line numbers. Atoms are listed when a hunk has more than one:

```
a1b[2c3d4e5f6] src/main.rs (+3 -1)
  1: fn main() {
  2:+    println!("new");
  3:-    old_call();
  4: }
  a1b[2c3d4e5f6]#1 @2 a1b[2c3d4e5f6]#2 @3
```

Bracket notation is prefix highlighting (same as `jj log`): `a1b` is the shortest unique prefix.

`jjc hunks --from REVSET` accepts any revset that resolves to one revision. It lists that revision's hunks against its parent, not a working-copy-only diff.

## Typical workflow

1. `jjc hunks` — list hunks, read the preview
2. `jjc hunks a1b` — inspect one hunk in detail if needed
3. `jjc pick a1b c3d -m "message"` — commit selected hunks
4. Or `jjc drop a1b` — revert a hunk to parent content
5. Or `jjc fold a1b --into @-` — squash a hunk into another revision

## Hunk selectors

| Syntax | Meaning |
| ---------- | ------------------------------------------ |
| `a1b` | Whole hunk (prefix match) |
| `a1b#2` | Change atom #2 within the hunk |
| `a1b@15` | Atom(s) covering target line 15 |
| `a1b@10-20` | Atom(s) covering target lines 10-20 |

## Hunk IDs

Run `jjc hunks` to discover IDs. Re-run if a selector is not found. Any unambiguous prefix works.

## Key differences from git-surgeon

- Operates on jj revisions, not Git staging area
- Uses jj transactions and operation log (`jj undo` works)
- `pick` = split selected hunks into a new commit
- `drop` = revert selected hunks to parent content
- `fold` = squash selected hunks into another revision
- No `stage`/`unstage` — jj has no staging area
