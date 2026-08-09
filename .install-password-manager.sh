#!/bin/bash

set -euo pipefail

brew_prefix() {
    if [[ "$(uname -m)" == "arm64" ]]; then
        printf '/opt/homebrew'
    else
        printf '/usr/local'
    fi
}

BREW_PREFIX="$(brew_prefix)"
OP_BIN="$BREW_PREFIX/bin/op"

case "$(uname -s)" in
Darwin)
    if ! command -v op >/dev/null 2>&1 && [[ ! -x "$OP_BIN" ]]; then
        printf '\n\033[1;35m==> %s\033[0m\n' "Bootstrap prerequisite: Homebrew & 1Password"

        if ! command -v brew >/dev/null 2>&1 && [[ ! -x "$BREW_PREFIX/bin/brew" ]]; then
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi

        eval "$("$BREW_PREFIX/bin/brew" shellenv)"

        brew list --cask 1password >/dev/null 2>&1 || brew install --cask 1password
        brew list --cask 1password-cli >/dev/null 2>&1 || brew install --cask 1password-cli
    elif [[ -x "$BREW_PREFIX/bin/brew" ]]; then
        eval "$("$BREW_PREFIX/bin/brew" shellenv)"
    fi

    OP_BIN="$(command -v op || printf '%s/bin/op' "$BREW_PREFIX")"
    if [[ ! -x "$OP_BIN" ]]; then
        echo "1Password CLI is not installed or not executable: $OP_BIN"
        exit 1
    fi

    accounts_file="$(mktemp)"
    trap 'rm -f "$accounts_file"' EXIT
    if ! "$OP_BIN" account list >"$accounts_file" 2>/dev/null || [[ ! -s "$accounts_file" ]]; then
        open -a '1Password'
        echo "Be sure to setup your account(s) and vault(s) in 1Password."
        echo "Then go to 'Settings > Developer' and enable 'Integrate with 1Password CLI'."
        echo "Also go to 'Settings > Developer' and enable 'Use the SSH agent'."
        read -r -p "Press Enter to continue..."
    fi
    ;;
*)
    echo "unsupported OS"
    exit 1
    ;;
esac
