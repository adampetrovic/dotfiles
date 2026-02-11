---
name: jujutsu
description: Version control using Jujutsu (jj), a Git-compatible VCS. Use when the user asks to commit, branch, push, pull, rebase, diff, log, resolve conflicts, manage bookmarks, or perform any version control operation in a jj repository (identified by a .jj/ directory). Also use when the user mentions "jj" explicitly.
---

# Jujutsu (jj) Version Control

Jujutsu is a Git-compatible VCS with a fundamentally different model. The working copy is always a commit (`@`), changes are tracked automatically (no staging area), and every change has a stable **change ID** in addition to a **commit ID**.

## Key Concepts

- **Working copy is a commit**: Every edit automatically amends `@`. No `add` or `stage` step.
- **Change ID vs Commit ID**: Change IDs (e.g. `kntqzsqt`) are stable across rewrites. Commit IDs (hashes) change on every amend. Always prefer change IDs.
- **`@` = working copy commit**, `@-` = parent, `@--` = grandparent.
- **Bookmarks** (not branches): `jj bookmark` replaces Git's branch concept.
- **No HEAD**: You use `jj edit <change_id>` to switch what you're working on.
- **Automatic rebasing**: Descendants are rebased automatically when you rewrite a commit.
- **Operation log**: Every `jj` command is an operation. Use `jj op log` and `jj undo` to navigate history.

## Detecting a jj Repository

Check for a `.jj/` directory at the workspace root. If the project uses jj, prefer `jj` commands over `git` commands.

A repo can be **colocated** (both `.jj/` and `.git/` exist). In colocated repos, `jj` and `git` can interoperate, but prefer `jj` for all operations.

## Essential Workflows

### Check status
```bash
jj status                    # or: jj st
jj log                       # show revision graph (default: local commits)
jj log -r 'all()'           # show all revisions
jj log -r '@'               # show only working copy
```

### Make changes (no staging needed)
Edit files normally. The working copy commit `@` is amended automatically on the next `jj` command.

### Describe (set commit message)
```bash
jj describe -m "message"            # describe current change
jj describe -m "message" -r <rev>   # describe a specific revision
```

### Create a new change
```bash
jj new                       # new empty change on top of @
jj new -m "message"          # new change with description
jj new <rev1> <rev2>         # new merge change with multiple parents
```

### Diff
```bash
jj diff                      # working copy changes vs parent
jj diff -r <rev>             # show changes in a specific revision
jj diff --from <rev1> --to <rev2>   # compare two revisions
jj diff --stat               # summary only
```

### Squash (move changes into parent)
```bash
jj squash                           # squash @ into @-
jj squash -m "message"              # squash with new description
jj squash --from <rev> --into <rev> # move changes between specific revisions
jj squash <path>                    # squash only specific files
```

### Edit a previous change
```bash
jj edit <change_id>          # set working copy to an existing change
```

### Split a change
```bash
jj split                     # interactively split @ into two changes
jj split <paths>             # split specific files into a new change
```

### Rebase
```bash
jj rebase -r @ -d <target>              # rebase single revision
jj rebase -s <source> -d <target>       # rebase revision and descendants
jj rebase -b <rev> -d <target>          # rebase whole branch
```

### Bookmarks (≈ Git branches)
```bash
jj bookmark list                         # list all bookmarks
jj bookmark create <name> -r <rev>       # create bookmark at revision
jj bookmark set <name> -r <rev>          # move bookmark to revision
jj bookmark move <name> --to <rev>       # move bookmark
jj bookmark delete <name>                # delete bookmark
```

### Git interop
```bash
jj git clone <url>                       # clone a git repo
jj git fetch                             # fetch from remote
jj git push                              # push all tracked bookmarks
jj git push -b <bookmark>               # push specific bookmark
jj git push --change <change_id>         # push a change (auto-creates bookmark)
```

### Undo & operation log
```bash
jj undo                      # undo last operation
jj op log                    # show operation history
```

### Abandon a change
```bash
jj abandon                   # abandon @ (deletes the change)
jj abandon <rev>             # abandon a specific revision
```

### Absorb changes into the stack
```bash
jj absorb                    # automatically distribute working copy changes into the right commits in the stack
```

## Revset Quick Reference

Revsets select sets of revisions. Used with `-r` flags.

| Expression | Meaning |
|---|---|
| `@` | Working copy commit |
| `@-` | Parent of working copy |
| `@--` | Grandparent |
| `x-` | Parents of x |
| `x+` | Children of x |
| `x::y` | x to y (ancestors of y that are descendants of x) |
| `x..y` | Ancestors of y excluding ancestors of x |
| `x::` | Descendants of x |
| `::x` | Ancestors of x |
| `trunk()` | The trunk/main bookmark |
| `bookmarks()` | All local bookmarks |
| `remote_bookmarks()` | All remote bookmarks |
| `heads()` | Head commits |
| `mine()` | Commits by the current user |
| `description(pattern)` | Commits matching description |
| `empty()` | Empty commits |
| `conflicts()` | Commits with conflicts |
| `x & y` | Intersection |
| `x \| y` | Union |
| `~x` | Complement (not in x) |

### Useful examples
```bash
jj log -r 'trunk()..@'                  # changes between trunk and working copy
jj log -r 'mine() & ~empty()'           # my non-empty commits
jj log -r 'bookmarks() & mine()'        # my bookmarks
jj log -r 'conflicts()'                 # find conflicted revisions
```

## Conflict Resolution

jj represents conflicts as materialised conflict markers in files. The markers look like:

```
<<<<<<< Conflict 1 of 1
+++++++ Contents of side #1
left side content
%%%%%%% Changes from base to side #2
-base content
+right side content
>>>>>>> Conflict 1 of 1
```

### Resolving conflicts

1. **Edit directly**: Modify the file to remove conflict markers, then let jj auto-snapshot.
2. **Use merge tool**: `jj resolve` launches an external merge tool.
3. **Choose a side**: `jj resolve --tool :ours` or `jj resolve --tool :theirs`.
4. **List conflicts**: `jj resolve --list` or `jj log -r 'conflicts()'`.

After editing conflict markers out of all files, the conflict is considered resolved on the next `jj` command.

## Important Notes for AI Agents

1. **No staging area**: Never suggest `jj add`. Files are tracked automatically. Use `.gitignore` and `jj file untrack <path>` to untrack.
2. **Non-interactive mode**: Always pass `-m "message"` to `describe`/`commit`/`new`. Never rely on `$EDITOR`.
3. **Prefer change IDs**: When referencing revisions in commands, use change IDs (short alphabetic strings like `kntqzsqt`) rather than commit hashes, because change IDs survive rewrites.
4. **Auto-rebase awareness**: Editing earlier commits automatically rebases descendants. Check for new conflicts with `jj log -r 'conflicts()'` after rewriting history.
5. **`jj commit` vs `jj new`**: `jj commit -m "msg"` is equivalent to `jj describe -m "msg" && jj new`. Both are valid; `commit` is familiar to Git users.
6. **Push workflow**: Set a bookmark → push. Example: `jj bookmark set my-feature -r @- && jj git push -b my-feature`.
7. **Colocated repos**: If `.git/` also exists, jj auto-syncs. Prefer jj commands over git commands.
8. **`--no-pager`**: Use `--no-pager` when capturing output programmatically: `jj --no-pager log`.
9. **`--color never`**: Use `--color never` when parsing output to avoid ANSI escape codes.

## Typical Feature Workflow

```bash
# Start from trunk
jj new trunk() -m "Add new feature"

# ... make edits (auto-tracked) ...

# Review what you've done
jj diff
jj log -r 'trunk()..@'

# Create a bookmark and push
jj bookmark create my-feature -r @
jj git push -b my-feature

# After review feedback, edit directly (no need to checkout)
jj edit <change_id>
# ... make changes ...
jj new   # done editing, move to new empty change

# Push updated bookmark
jj bookmark set my-feature -r <change_id>
jj git push -b my-feature
```

## Reference

For detailed docs, see: https://jj-vcs.dev/latest/

For command help: `jj help <command>` or `jj help -k <keyword>` where keyword is one of: bookmarks, config, filesets, glossary, revsets, templates, tutorial.
