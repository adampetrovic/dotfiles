# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Chezmoi-managed dotfiles repository for macOS systems. It uses templating to support both personal and work machine configurations.

## Key Technologies

- **Dotfile Management**: Chezmoi (https://www.chezmoi.io/)
- **Version Control**: Jujutsu (jj) - NOT Git
- **Shell**: Zsh with Zinit plugin manager
- **Prompt**: Spaceship prompt with custom segments
- **Editors**: Vim (with NeoBundle) and Neovim (Kickstart configuration)
- **Terminal**: WezTerm
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
- Personal profile: `profile=personal`
- Work profile: `profile=work`
- Templates check `{{ eq .profile "work" }}` for conditional configuration

### Key Configuration Files
- `.chezmoi.toml.tmpl`: Main Chezmoi configuration with profile selection
- `.chezmoiscripts/`: Setup scripts that run on `chezmoi apply`
- `dot_config/`: XDG config directory contents
- `dot_zshrc`: Main Zsh configuration
- `dot_wezterm.lua`: WezTerm terminal configuration

### Shell Configuration
The Zsh setup uses a modular approach:
1. Zinit manages plugins and completions
2. Spaceship prompt with custom segments (including jj status)
3. Extensive aliases defined in `dot_zshrc`
4. Path management for various tools (Homebrew, Go, Python, etc.)

### Development Tools Integration
- **Languages**: Go, Python (pyenv), Node (nvm), Ruby (rbenv), Java (jenv for work)
- **Kubernetes**: kubectl with krew plugins, Talos CLI
- **Cloud**: AWS CLI, Google Cloud SDK
- **Containers**: Docker, Colima

## Important Notes

1. **Version Control**: This repo uses Jujutsu (jj), not Git. Use jj commands for version control operations.

2. **1Password Integration**: SSH keys and secrets are retrieved from 1Password. The setup scripts handle this automatically.

3. **Work vs Personal**: The work profile includes additional tools like Atuin, Java configuration, and specific Kubernetes contexts.

4. **Executable Scripts**: Files in `.chezmoiscripts/` run during `chezmoi apply`. They handle tool installation and initial setup.

5. **Template Variables**: When editing `.tmpl` files, maintain the Go template syntax and test changes with `chezmoi diff` before applying.

## Key Dependencies

Essential tools that should be installed:
- Homebrew (package manager)
- Chezmoi (dotfile management)
- Jujutsu (version control)
- 1Password CLI (for secrets)
- WezTerm (terminal emulator)