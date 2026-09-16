# AGENTS.md — Dotfiles (Chezmoi)

> Instructions for AI agents working in this chezmoi dotfiles repository.

## Repository Overview

Chezmoi-managed dotfiles for macOS. Supports **personal** and **work** profiles via Go templating. Personal secrets and SSH agent/signing use 1Password; work machines must use Keeper for secrets and Secretive for SSH instead of 1Password.

## Version Control

This repo uses **Jujutsu (jj)**, not Git. Use `jj` commands for all VCS operations.

## Key Files & Structure

```
.chezmoi.toml.tmpl          # Chezmoi config — profile selection, age encryption, password-manager hook
.chezmoiexternal.toml       # External deps (zinit)
.chezmoiignore.tmpl         # Files to skip (conditional on profile)
.chezmoiscripts/            # Run scripts triggered by chezmoi apply
  run_once_before_*         # Bootstrap (Homebrew, 1Password for personal, Self Service reminders for work Keeper/Secretive)
  run_onchange_after_10-*   # Package install (Brewfile; Keeper-backed on work)
  run_after_11-*            # Always update private work-scripts HEAD and reconcile packaged Pi skills
  run_onchange_after_30-*   # Kubernetes setup
  run_onchange_after_90-*   # macOS defaults, vim, languages, wireguard
  run_onchange_after_91-*   # macOS apps, dock, energy, finder, input, screen

dot_Brewfile.tmpl           # Homebrew packages (templated per profile)
dot_zshrc.tmpl              # Zsh config (zinit, spaceship prompt)
dot_zsh/aliases.zsh.tmpl    # Shell aliases
dot_jjconfig.toml.tmpl      # Jujutsu VCS config
dot_wezterm.lua.tmpl        # WezTerm terminal config
dot_aerospace.toml.tmpl     # AeroSpace window manager
dot_config/git/config.tmpl  # Git config
dot_config/mise/config.toml.tmpl  # mise (language version manager)
dot_config/sops/age/keys.txt.tmpl # SOPS age key (personal, from 1Password)
private_dot_ssh/private_config.tmpl # SSH config (0600 file / 0700 dir; personal 1Password agent, work Secretive agent)
dot_pi/agent/              # Pi coding agent config (extensions, skills, settings)

alfred/                     # Alfred preferences (not applied to target, in .chezmoiignore)
istat/                      # iStat Menus config (not applied)
rectangle/                  # Rectangle Pro config (not applied)
```

## Templating

Files ending in `.tmpl` use Go templates. Available variables:

- `{{ .profile }}` — `"personal"` or `"work"`
- `{{ .work }}` / `{{ .personal }}` — boolean flags
- `{{ .email }}` — email address
- `{{ .full_name }}` — `"Adam Petrovic"`
- Personal profile can use 1Password references via `onepasswordRead` template function
- Work profile must not call `onepasswordRead`/`onepasswordDocument`; use Keeper (`keeper`, `keeperDataFields`, `keeperFindPassword`) or skip until migrated

## Work Profile Integrations

### Keeper records

Work secrets are injected with chezmoi's Keeper template functions. Keeper Commander must be authenticated before rendering work templates. Current Login records and fields:

- `Homebrew GitHub API Token` — GitHub PAT in the standard Password field. Used as `HOMEBREW_GITHUB_API_TOKEN` for private Homebrew access and as `GITHUB_TOKEN` while `mise install` performs GitHub API and artifact-attestation requests.
- `Work Mac Login` — macOS login password in the standard Password field. Used for work-profile sudo because corporate policy disables sudo timestamp caching (`sudo -v` succeeds but an immediate `sudo -n true` fails).

These values are rendered into generated run scripts. Never print rendered scripts, capture them in logs, or expose them in diffs. Safe lookup test:

```bash
chezmoi execute-template '{{ if (keeperFindPassword "Homebrew GitHub API Token") }}OK{{ else }}EMPTY{{ end }}'
```

### Private work Pi skills

Private skills must never be copied into this public repository or represented by individual `symlink_*` source entries. Delivery is:

1. Work profile installs `adampetrovic/tap/work-scripts` from `HEAD`.
2. The private formula packages all skill directories under `$(brew --prefix work-scripts)/share/work-scripts/pi-skills` and installs `bin/sync-pi-skills`.
3. `.chezmoiscripts/run_after_11-update-work-scripts.sh.tmpl` fetches/upgrades HEAD and invokes the packaged reconciler.
4. The reconciler links packaged skills into `~/.pi/agent/skills`, tracks owned links in `${XDG_STATE_HOME:-$HOME/.local/state}/chezmoi/work-pi-skills.manifest`, prunes only unchanged owned links, and preserves unrelated/personal skills.

Run only the work-skills update with:

```bash
chezmoi apply --source-path .chezmoiscripts/run_after_11-update-work-scripts.sh.tmpl
```

The private work-scripts and Homebrew tap repositories use Git; preserve unrelated working-tree changes in either repository. This public chezmoi repository uses Jujutsu.

### Work sudo automation

`.chezmoitemplates/work-sudo.sh` provides two paths:

- A shell `sudo` wrapper using `sudo -S` for sudo commands in macOS configuration scripts.
- An Expect wrapper for repeated nested sudo prompts from Homebrew cask installers.

The password is piped to Expect over stdin rather than exported in its environment. Do not replace this with sudo timestamp keepalive logic on work; corporate policy makes the cache unavailable. Personal sudo behavior remains 1Password-backed and unchanged.

## Encryption

Files prefixed with `encrypted_` and suffixed `.age` are age-encrypted.

**Rules for encrypted files:**
- NEVER copy plaintext into the chezmoi source directory
- For encrypted non-templates: edit the live file, then run `chezmoi encrypt <live-file> > <chezmoi-source-path>`
- For encrypted templates (`encrypted_*.tmpl.age`): decrypt to a private temporary file, edit and validate every profile there, then re-encrypt the template; do not encrypt the rendered live file
- To verify: `chezmoi decrypt <source-file>`
- Remove temporary plaintext files when finished
- The age recipient key is in `.chezmoi.toml.tmpl`

Currently encrypted: `dot_pi/agent/encrypted_AGENTS.md.tmpl.age`

## Common Commands

```bash
chezmoi apply              # Apply all dotfiles to $HOME
chezmoi diff               # Preview changes before applying
chezmoi add <file>         # Add a new file to chezmoi
chezmoi re-add <file>      # Re-add a changed file (non-encrypted only)
chezmoi edit <file>        # Edit a managed file
chezmoi encrypt <file>     # Encrypt a file with age
chezmoi decrypt <file>     # Decrypt an age-encrypted file
chezmoi managed            # List all managed files
```

## Important Rules

1. **Encrypted files**: Check for `encrypted_` prefix before updating any file. See Encryption section.
2. **Profile-aware edits**: When editing `.tmpl` files, preserve Go template syntax and conditionals.
3. **Run scripts**: Scripts in `.chezmoiscripts/` execute during `chezmoi apply`. `run_onchange_` scripts re-run when their content changes — edit carefully.
4. **Don't delete files**: A previous incident wiped 203 files from this repo. Always use targeted edits, never bulk operations on the source directory.
5. **Test before pushing without leaking secrets**: Prefer `jj diff --stat`, `jjc hunks`, shell syntax checks, and profile rendering with mock password-manager commands. Do not run or share unrestricted `chezmoi diff` output because work run scripts contain rendered Keeper secrets. If destination comparison is necessary, exclude scripts and inspect output locally: `chezmoi diff --exclude=scripts`.
6. **Password manager dependency**: The pre-hook (`.install-password-manager.sh`) installs 1Password for personal profiles only. Work Keeper Password Manager, Keeper Commander CLI, and Secretive installation is handled via work Self Service, not Homebrew; the hook only warns if they are missing. Do not add active work-profile `onepasswordRead` or `onepasswordDocument` calls.
7. **SSH agent split**: Personal profile keeps 1Password SSH agent/signing. Work profile uses Secretive's socket (`~/Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh`) for SSH auth; do not reintroduce 1Password agent paths into active work templates.
