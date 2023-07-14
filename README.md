# Dotfiles

Install dotfiles on a new machine with the following:

```sh
xcode-select --install
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply --ssh git.petrovic.network/adampetrovic/dotfiles
``` 
