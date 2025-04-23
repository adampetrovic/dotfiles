#!/bin/sh

# exit immediately if password-manager-binary is already in $PATH
type op >/dev/null 2>&1 && echo "1password already installed" && exit

case "$(uname -s)" in
Darwin)
    echo "Installing Homebrew and 1Password"
    # commands to install password-manager-binary on Darwin
    if ! command -v brew &>/dev/null; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    eval "$(/usr/local/bin/brew shellenv)"
    brew list 1password &>/dev/null || brew install 1password
    brew list 1password-cli &>/dev/null || brew install 1password-cli
    if [[ $(op account list | wc -l) -lt 1 ]]; then
        open -a '1Password'
        echo "Be sure to setup your account(s) and vault(s) in 1password."
        echo "Then go to 'Settings > Developer' and enable 'Integrate with 1Password CLI'."
        echo "Optionally, go to 'Settings > Developer' and enable 'Use the SSH agent'."
        read -p "Enter to continue..."
    fi
    ;;
*)
    echo "unsupported OS"
    exit 1
    ;;
esac
