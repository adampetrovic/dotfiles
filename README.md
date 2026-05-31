# Dotfiles

Install dotfiles on a new machine with the following:

```sh
xcode-select --install
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply adampetrovic/dotfiles
```

The HTTPS shorthand (`adampetrovic/dotfiles`) clones the public repo without needing
an SSH key, so it works on a fresh machine. chezmoi prompts for profile (personal/work)
and email, then 1Password handles the rest of the secrets during apply.
