# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Chezmoi-managed dotfiles repository for macOS systems. It uses templating to support both personal and work machine configurations.

## Key Technologies

- **Dotfile Management**: Chezmoi (https://www.chezmoi.io/)
- **Version Control**: Jujutsu (jj) - NOT Git
- **Shell**: Zsh with Zinit plugin manager (managed via `.chezmoiexternal.toml`)
- **Prompt**: Spaceship prompt with custom segments
- **Editor**: Vim (with NeoBundle)
- **Terminal**: WezTerm (templated for work/personal)
- **Secret Management**: 1Password integration

## Common Commands

```bash
# Apply dotfile changes
chezmoi apply

# Edit a dotfile
chezmoi edit <file>

# Add a new dotfile
chezmoi add <file>

# See what would change
chezmoi diff

# Update from source directory
chezmoi update

# Version control (using jj, not git)
jj status
jj diff
jj commit -m "message"
```

## Architecture & Structure

### Templating System
Files with `.tmpl` extension use Go templating to handle differences between personal and work machines:
- Profile is selected via `promptStringOnce` on first run
- Templates use `{{ .work }}` and `{{ .personal }}` boolean flags
- The `profile` string is also available as `{{ .profile }}`

### Key Configuration Files
- `.chezmoi.toml.tmpl`: Main Chezmoi configuration with profile selection
- `.chezmoiexternal.toml`: External dependencies (e.g., zinit)
- `.chezmoiversion`: Minimum required chezmoi version
- `.chezmoiscripts/`: Setup scripts that run on `chezmoi apply`
- `dot_config/`: XDG config directory contents
- `dot_zshrc.tmpl`: Main Zsh configuration
- `dot_wezterm.lua.tmpl`: WezTerm terminal configuration (work-specific hyperlinks)

### Script Organization
All run scripts live in `.chezmoiscripts/`:
- `run_once_before_*`: Bootstrap (Homebrew, 1Password)
- `run_onchange_after_10-*`: Package installation (triggers on Brewfile changes)
- `run_onchange_after_30-*`: Kubernetes setup
- `run_onchange_after_90-*`: macOS defaults (split by category: general, input, energy, screen, finder, dock, apps)
- `run_onchange_after_90-*`: Language tools (mise), vim plugins, wireguard

### Shell Configuration
The Zsh setup uses a modular approach:
1. Zinit manages plugins and completions (installed via chezmoi externals)
2. Spaceship prompt with custom segments (including jj status)
3. Aliases split into `dot_zsh/aliases.zsh.tmpl`
4. Path management for various tools (Homebrew, Go, Python, etc.)

### Development Tools Integration
- **Languages**: Go, Python, Node, Java (work only) — managed by mise
- **Kubernetes**: kubectl with krew plugins, Talos CLI
- **Cloud**: AWS CLI, Google Cloud SDK (work only)
- **Containers**: Docker

## Important Notes

1. **Version Control**: This repo uses Jujutsu (jj), not Git. Use jj commands for version control operations.

2. **1Password Integration**: SSH keys and secrets are retrieved from 1Password. The setup scripts handle this automatically.

3. **Work vs Personal**: The work profile includes additional tools like Atuin, Java configuration, specific Kubernetes contexts, and work-specific WezTerm hyperlinks.

4. **Executable Scripts**: Files in `.chezmoiscripts/` run during `chezmoi apply`. Most use `run_onchange_` to only re-run when content changes.

5. **Template Variables**: When editing `.tmpl` files, maintain the Go template syntax and test changes with `chezmoi diff` before applying.

## Key Dependencies

Essential tools that should be installed:
- Homebrew (package manager)
- Chezmoi >= 2.40.0 (dotfile management)
- Jujutsu (version control)
- 1Password CLI (for secrets)
- WezTerm (terminal emulator)
