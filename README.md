# Dotfiles

Install dotfiles on a new machine with the following:

```sh
xcode-select --install
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply adampetrovic/dotfiles
```

The HTTPS shorthand (`adampetrovic/dotfiles`) clones the public repo without needing
an SSH key, so it works on a fresh machine. chezmoi prompts for profile (personal/work)
and email.

- `personal` uses 1Password for secret templates, SSH agent, and SSH signing.
- `work` must not use 1Password. Homebrew does not install Keeper or
  Secretive. Install Keeper Password Manager, Keeper Commander CLI, and
  Secretive via work Self Service. Keeper backs secret lookups; Secretive backs
  SSH authentication via Apple Secure Enclave keys.

## Work Keeper migration checklist

For work-profile `chezmoi apply` to be fully Keeper-backed, the remaining work is:

1. Install Keeper Password Manager and Keeper Commander CLI from work Self
   Service. Then sign in to Keeper Commander and create a persistent session, as
   required by chezmoi's Keeper template functions (`keeper`,
   `keeperDataFields`, and `keeperFindPassword`).
2. Create Keeper records for every work secret that chezmoi needs, then record
   their Keeper UID or path names. At minimum this includes:
   - GitHub/Homebrew token used for private taps such as `adampetrovic/tap/work-scripts`.
   - Work sudo password if non-interactive sudo priming is still desired; otherwise `sudo -v` prompts interactively.
   - Any work WireGuard config if it should be managed by chezmoi.
   - Atuin sync settings, SOPS age identity, and encrypted Pi agent config if those should exist on work machines.
3. Replace active work-profile `onepasswordRead` / `onepasswordDocument` calls
   with Keeper lookups. Useful chezmoi patterns:

   ```gotemplate
   {{ keeperFindPassword "<keeper-record-uid-or-path>" }}
   {{ (keeper "<keeper-record-uid>").data.title }}
   {{ index (keeperDataFields "<keeper-record-uid>").password 0 }}
   ```

4. Install Secretive from work Self Service. Then create the work SSH key inside
   the Secretive app UI (`Command + N`) and add the public key to GitHub and
   Bitbucket. Secure Enclave keys cannot be created via CLI. Git/Jujutsu commit
   signing remains disabled for work until a Secretive-compatible signing
   configuration is explicitly added.
5. Once the Keeper records and signing approach are known, migrate these files:
   - `.chezmoiscripts/run_onchange_after_10-install-packages.sh.tmpl`
   - `.chezmoiscripts/run_onchange_after_90-install-wireguard-config.sh.tmpl`
   - `.chezmoitemplates/macos-sudo-prime.sh`
   - `.chezmoiignore.tmpl`
   - `dot_config/atuin/config.toml.tmpl`
   - `dot_config/git/config.tmpl`
   - `dot_config/git/allowed_ssh_signers.tmpl`
   - `dot_jjconfig.toml.tmpl`
   - `private_dot_ssh/private_config.tmpl`
   - `dot_config/mise/config.toml.tmpl`
   - `dot_config/sops/age/keys.txt.tmpl`
   - any ignored personal-only agent config that should exist on work machines

Until those mappings exist, run work-profile apply with a Keeper-sourced
`HOMEBREW_GITHUB_API_TOKEN` exported if private Homebrew taps are required.
