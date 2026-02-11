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

## User Configuration (~/.jjconfig.toml)

The following customisations are active and **must be used in preference to generic jj commands** where applicable.

### Identity & Signing

- **User**: Adam Petrovic (`adam@petrovic.com.au`)
- **Commit signing**: SSH-based via 1Password (`behaviour = "own"` — signs only the user's own commits automatically).

### UI Settings

- **Editor**: `vim`
- **Default command**: `jj` with no subcommand runs `jj log`.
- **Diff formatter**: `delta --dark` (external diff tool).
- **Auto-pushed bookmark prefix**: `apetrovic/push-<short_change_id>` (used by `jj git push --change`).

### Git Settings

- `auto-local-bookmark = false` — fetching a remote bookmark does **not** create a local bookmark automatically.
- `auto-track-bookmarks = true` — newly fetched remote bookmarks are tracked.

### Fix Tools

- **detekt** (Kotlin linter): `jj fix` runs `./gradlew detekt` on `**/*.kt` files.

### Immutability

- `immutable_heads()` = `trunk() | tags()` — trunk and tags are immutable; everything else is mutable.

### Custom Revset Aliases

These are available in any `-r` expression:

| Alias | Definition | Use |
|---|---|---|
| `mine()` | `user("adam@petrovic.com.au")` | Current user's commits |
| `user(x)` | `author(x)` | Commits by author substring |
| `stack()` | `ancestors(mutable() & (..@ \| @::), 2)` | Current mutable stack (ancestors depth 2) |
| `streams()` | `heads(::@ & bookmarks())` | Bookmark heads that are ancestors of `@` |
| `change()` | `::@ ~ ::trunk()` | All commits on current change path from trunk |
| `branch_point()` | `roots(::@ ~ ::trunk())-` | The commit where the current line diverged from trunk |
| `remote_head()` | `remote_bookmarks() & ancestors(@) & heads(remote_bookmarks())` | The remote bookmark head in the ancestry of `@` |
| `local_changes()` | `@ ~ remote_head()` | Working copy minus what's on the remote |
| `merged_remotes()` | `remote_bookmarks() & ::main@origin & heads(remote_bookmarks() & mine())` | User's remote bookmarks merged into main |

### Custom Log Revset

The default `jj log` shows: `@ | ancestors(trunk()..((visible_heads() & mine()) | heads(bookmarks())), 2) | trunk()`.

This means the log displays: the working copy, trunk, and 2 levels of ancestry from the user's visible heads and tracked bookmark heads above trunk.

### Custom Aliases

**Prefer these aliases over raw commands.** They encapsulate the user's workflows.

| Alias | Command | Description |
|---|---|---|
| `jj sync` | `jj git fetch --all-remotes` | Fetch from all remotes (with spinner via `gum`). |
| `jj restack` | sync + `jj rebase --skip-emptied -d trunk()` | Sync remotes, then rebase current branch onto trunk. |
| `jj start "message"` | sync + `jj new -r trunk() -m "message"` | Start a new feature: sync, then create a new change off trunk. |
| `jj merge-main` | `jj new -r trunk() @ -m "merge main"` | Create a merge commit combining trunk and current `@`. |
| `jj tug` | `jj bookmark move --from 'heads(::@- & bookmarks())' --to @-` | Move the bookmark in `@-`'s ancestry forward to `@-`. Use after squashing/amending to keep the bookmark pointing at the right commit. |
| `jj forget <bookmark>` | `jj bookmark forget` | Forget a bookmark (removes locally without propagating deletion to remote). |
| `jj a` | `jj abandon` | Short alias for abandon. |
| `jj yoink` | Finds the single bookmark in `trunk()..@` and moves it to `@`. | Move the only bookmark between trunk and working copy to the current change. Errors if 0 or >1 bookmarks found. |
| `jj track <name>` | sync + `jj bookmark track <name>@origin` + `jj new -r <name>` | Fetch, track a remote bookmark, and start working on top of it. |
| `jj remote-diff` | sync + `jj diff --from <bookmark>@origin --to @` | Show what local changes would be pushed compared to the remote bookmark. |
| `jj reset-to-remote` | Rebases children onto remote, abandons `@`, resets bookmark to remote. | **Destructive.** Discard all local changes and reset to the remote bookmark state. Prompts for confirmation. |
| `jj split-changes` | Splits unpushed local changes off the current bookmark into a new changeset. | Separates local-only changes from what's already on the remote. |

### Typical Feature Workflow (Using Custom Aliases)

```bash
# Start a new feature from trunk (fetches first)
jj start "Add new feature"

# ... make edits (auto-tracked) ...

# Review what you've done
jj diff
jj log

# Create a bookmark and push
jj bookmark create my-feature -r @
jj git push -b my-feature

# After more edits, move the bookmark forward
jj tug
jj git push -b my-feature

# Or if the bookmark is behind, yoink it to current change
jj yoink
jj git push -b my-feature

# Rebase onto latest trunk
jj restack

# See what would be pushed vs remote
jj remote-diff

# If you need to discard local changes and match the remote
jj reset-to-remote
```

### Generic Feature Workflow (Without Aliases)

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

Full user config: `~/.jjconfig.toml`
