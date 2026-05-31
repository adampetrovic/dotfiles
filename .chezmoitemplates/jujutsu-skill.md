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

For new feature work in this environment, prefer `jj start "message"` (documented below) so the change is created from `trunk()` and described before editing. If `@` already contains unrelated changes, run `jj new` first instead of mixing work.

### Diff
```bash
jj diff --git                # preferred for agents: standard unified +/- diff
jj diff                      # working copy changes vs parent (may use configured formatter)
jj diff -r <rev> --git       # show changes in a specific revision
jj diff --from <rev1> --to <rev2> --git   # compare two revisions
jj diff --stat               # summary only
```

Prefer `--git` when reviewing, quoting, or parsing output; the default formatter may be customized and harder to read in agent transcripts.

### Squash (move changes into parent)
```bash
jj squash -m "combined message"                  # squash @ into @- without opening an editor
jj squash --use-destination-message              # squash and keep the destination/parent message
jj squash --from <rev> --into <rev> -m "message" # move changes between specific revisions
jj squash -m "combined message" <path>           # squash only specific files
```

Bare `jj squash` can prompt for a combined message when both source and destination have descriptions; avoid it in agent/non-interactive sessions.

### Edit a previous change
```bash
jj edit <change_id>          # set working copy to an existing change
```

### Split a change
```bash
jj split -m "selected change message" <paths>  # non-interactively split specific files into the first change
jj split -i                                    # interactive split; avoid in agent sessions unless explicitly requested
```

Bare `jj split` is interactive and can hang waiting for a diff editor and messages.

For **hunk-level** (sub-file) splitting without an interactive TUI, use `jjc` — see [Hunk-level operations with `jjc`](#hunk-level-operations-with-jjc) below.

### Hunk-level operations with `jjc`

`jjc` is a non-interactive companion tool for **hunk-level** edits — a scriptable alternative to interactive `jj split` / `jj squash -i`. It is ideal for agent sessions because it never opens a TUI or diff editor. It links directly against `jj-lib`, so it handles snapshots, transactions, and descendant rebasing the same way `jj` does.

**Requirements & limits**: jj ≥ 0.41.0. Text files only — binary files, renames, and deletions are unsupported. Minimal immutable-commit checking, and `.gitignore` patterns from git config are not loaded.

**Commands**:

| Command | Purpose |
|---|---|
| `jjc hunks [ID]` | List selectable hunks in a revision; with an `ID` (or prefix), inspect that hunk with numbered diff lines |
| `jjc pick [IDS]... -m <msg>` | Commit the selected hunks from a revision into a **new** commit |
| `jjc drop [IDS]...` | Drop the selected hunks, reverting them to the parent's content |
| `jjc fold [IDS]... --into <rev>` | Squash the selected hunks into another revision |

Common options: `-r, --from <rev>` chooses the source revision (default `@`). `jjc hunks` also takes `--full` (numbered lines for every hunk) and `--blame` (originating commit per line). `jjc fold` takes `--into <rev>` and `--select <REVSET:ID[,ID...]>` to assign selectors to a source revision.

**Hunk selectors** (the `IDS` arguments) target hunks non-interactively:
- `ID` — a whole hunk by its ID or unique prefix (e.g. `07`)
- `ID#N` — the Nth change-atom within a hunk
- `ID@L` — a specific line (or `ID@L-R` for a line range) within a hunk

**Typical flow** (extract one hunk into its own commit):
```bash
jjc hunks                         # discover hunk IDs in @, e.g. "07[6203…] a.txt (+2 -1)"
jjc hunks 07 --full               # inspect that hunk with numbered lines
jjc pick 07 -m "extract a.txt edits"   # split it into a new commit; remaining hunks stay in @
jj st                             # verify the result
```

Note: brand-new files, renames, deletions, and binary files show as `file-level change; hunk selection not supported yet` — use `jj split <path>` for those instead.

#### Splitting one change into several commits programmatically

This is the primary agent use case: a working copy `@` contains several unrelated changes (often across the same files) that should become separate, well-described commits — without an interactive editor. `jjc pick` peels selected hunks **out of** the source revision into a **new commit placed below it**, leaving the remainder behind. Repeat to build a clean stack:

```bash
# 1. Enumerate the hunks in the working copy
jjc hunks
#   07[…] a.txt (+2 -1)
#   0f[…] b.txt (+1 -1)
#   1a[…] a.txt (+5 -0)

# 2. Peel each logical group into its own commit, in the order you want them stacked.
#    Multiple selectors in one `pick` go into a single commit.
jjc pick 07 1a -m "feat: implement X"     # two hunks → one commit beneath @
jjc pick 0f    -m "test: cover X"          # next commit beneath @

# 3. Describe whatever logical change remains in @ (or pick it too).
jj describe -m "chore: leftover tweak"

# 4. Always verify the resulting stack.
jj log -r 'trunk()..@'
jj st
```

**Sub-hunk precision** — when a single hunk mixes concerns, split *within* it using the selector suffixes:
- `ID#N` — only the Nth change-atom of hunk `ID` (atom indices are shown by `jjc hunks ID --full`).
- `ID@L` or `ID@L-R` — only line `L` (or line range `L`–`R`) of hunk `ID`.

```bash
jjc hunks 07 --full                  # show numbered lines + atom indices for hunk 07
jjc pick 07@10-20 -m "feat: just the new validation"   # take only lines 10–20
```

**Routing hunks into an existing commit** — to move specific hunks from `@` into an earlier commit in the stack (e.g. fixing up a commit you already made), use `fold`:

```bash
jjc fold 0f --into <change_id>       # squash hunk 0f from @ into an existing revision
```

**Discarding hunks** — to throw away selected hunks (revert them to parent content) rather than commit them:

```bash
jjc drop 1a                          # revert hunk 1a in @ back to parent
```

Guidance for agents: prefer `jjc pick`/`fold`/`drop` over `jj split -i` / `jj squash -i` whenever the user wants commits separated by **content** rather than by whole file — it is fully non-interactive and never opens a TUI. Hunk IDs are recomputed after each mutation, so re-run `jjc hunks` between operations, and finish with `jj st` + `jj log -r 'trunk()..@'` to confirm the stack.

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

1. **Edit directly (preferred for agents)**: Modify the file to remove conflict markers, then let jj auto-snapshot.
2. **List conflicts**: `jj resolve --list` or `jj log -r 'conflicts()'`.
3. **Choose a side non-interactively**: `jj resolve --tool :ours` or `jj resolve --tool :theirs`.
4. **Use merge tool only when interactive**: bare `jj resolve` launches an external merge tool and can hang.

After editing conflict markers out of all files, the conflict is considered resolved on the next `jj` command.

## Important Notes for AI Agents

1. **No staging area**: Never suggest `jj add`. Files are tracked automatically. Use `.gitignore` and `jj file untrack <path>` to untrack.
2. **Non-interactive mode**: Always pass `-m "message"` (or `--use-destination-message` for squash) to commands that may ask for descriptions: `describe`, `commit`, `new`, `squash`, `split`. Never rely on `$EDITOR`.
3. **Avoid interactive modes**: Do not run bare `jj split`, `jj split -i`, `jj squash -i`, or bare `jj resolve` in agent sessions unless the user explicitly wants an interactive tool. For hunk-level work, reach for `jjc` instead.
4. **Prefer `jj diff --git`**: Use Git-format diffs when reviewing, quoting, or parsing output; add `--color never` for machine parsing.
5. **Verify after mutations**: Run `jj st` after operations that rewrite or discard state (`squash`, `rebase`, `abandon`, `restore`, `undo`, `absorb`, `jjc pick/drop/fold`) to confirm the result.
6. **Prefer change IDs**: When referencing revisions in commands, use change IDs (short alphabetic strings like `kntqzsqt`) rather than commit hashes, because change IDs survive rewrites.
7. **Auto-rebase awareness**: Editing earlier commits automatically rebases descendants. Check for new conflicts with `jj log -r 'conflicts()'` after rewriting history.
8. **`jj commit` vs `jj new`**: `jj commit -m "msg"` is equivalent to `jj describe -m "msg" && jj new`. Both are valid; `commit` is familiar to Git users.
9. **Push workflow**: Set a bookmark → push. Example: `jj bookmark set my-feature -r @- && jj git push -b my-feature`.
10. **Colocated repos**: If `.git/` also exists, jj auto-syncs. Prefer jj commands over git commands.
11. **`--no-pager`**: Use `--no-pager` when capturing output programmatically: `jj --no-pager log`.
12. **`--color never`**: Use `--color never` when parsing output to avoid ANSI escape codes.
13. **Programmatic commit splitting**: To break a mixed working copy into separate logical commits without a TUI, use `jjc pick` (peel hunks into new commits), `jjc fold` (route hunks into an existing commit), and `jjc drop` (discard hunks) — never `jj split -i`. See [Splitting one change into several commits programmatically](#splitting-one-change-into-several-commits-programmatically).

## User Configuration (~/.jjconfig.toml)

The following customisations are active and **must be used in preference to generic jj commands** where applicable.

### Identity & Signing

- **User**: Adam Petrovic (`adam@petrovic.com.au`)
{{ if .personal -}}
- **Commit signing**: SSH-based via 1Password (`behaviour = "own"` — signs only the user's own commits automatically).
{{ else if .work -}}
- **Commit signing**: disabled until the work profile is migrated to a Keeper-compatible signing flow.
{{ end -}}

### UI Settings

- **Editor**: `vim`
- **Default command**: `jj` with no subcommand runs `jj log`.
- **Diff formatter**: `delta --dark` (external diff tool).
- **Auto-pushed bookmark prefix**: `apetrovic/push-<short_change_id>` (used by `jj git push --change`).

### Git Settings

- `[git] auto-local-bookmark = false` — fetching a remote bookmark does **not** create a local bookmark automatically.
- `[remotes.origin] auto-track-bookmarks = "glob:*"` — newly fetched origin bookmarks are tracked.

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
jj diff --git
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
jj diff --git
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

`jjc` source & docs: https://tangled.org/akashina.tngl.sh/jjc
