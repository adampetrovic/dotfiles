# AGENTS.md — Dotfiles (Chezmoi)

> Instructions for AI agents working in this chezmoi dotfiles repository.

## Repository Overview

Chezmoi-managed dotfiles for macOS. Supports **personal** and **work** profiles via Go templating. Secrets are encrypted with age and sourced from 1Password.

## Version Control

This repo uses **Jujutsu (jj)**, not Git. Use `jj` commands for all VCS operations.

## Key Files & Structure

```
.chezmoi.toml.tmpl          # Chezmoi config — profile selection, age encryption, 1Password hook
.chezmoiexternal.toml       # External deps (zinit)
.chezmoiignore.tmpl         # Files to skip (conditional on profile)
.chezmoiscripts/            # Run scripts triggered by chezmoi apply
  run_once_before_*         # Bootstrap (Homebrew, 1Password)
  run_onchange_after_10-*   # Package install (Brewfile)
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
dot_config/sops/age/keys.txt.tmpl # SOPS age key (from 1Password)
dot_ssh/config.tmpl         # SSH config
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
- 1Password references via `onepasswordRead` template function

## Encryption

Files prefixed with `encrypted_` and suffixed `.age` are age-encrypted.

**Rules for encrypted files:**
- NEVER copy plaintext into the chezmoi source directory
- To update: `chezmoi encrypt <live-file> > <chezmoi-source-path>`
- To verify: `chezmoi decrypt <source-file>`
- The age recipient key is in `.chezmoi.toml.tmpl`

Currently encrypted: `dot_pi/agent/encrypted_AGENTS.md.age`

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
5. **Test before pushing**: Run `chezmoi diff` to verify changes won't clobber existing config.
6. **1Password dependency**: The pre-hook (`.install-password-manager.sh`) requires 1Password CLI. If it fails, scripts that reference `onepasswordRead` will also fail.
