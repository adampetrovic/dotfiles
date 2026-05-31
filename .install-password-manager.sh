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
profile="${1:-${CHEZMOI_PROFILE:-}}"

if [ -z "$profile" ]; then
    for config_file in \
        "${CHEZMOI_CONFIG_FILE:-}" \
        "$HOME/.config/chezmoi/chezmoi.toml" \
        "$HOME/Library/Application Support/chezmoi/chezmoi.toml"; do
        [ -n "$config_file" ] || continue
        [ -r "$config_file" ] || continue
        profile="$(awk -F= '
            $1 ~ /^[[:space:]]*profile[[:space:]]*$/ {
                value=$2
                sub(/^[[:space:]]*/, "", value)
                sub(/[[:space:]]*$/, "", value)
                gsub(/^"|"$/, "", value)
                print value
                exit
            }
        ' "$config_file")"
        [ -n "$profile" ] && break
    done
fi

case "$profile" in
personal|work)
    ;;
*)
    echo "Unable to determine chezmoi profile; refusing to install a password manager." >&2
    echo "Set [data].profile in ~/.config/chezmoi/chezmoi.toml or export CHEZMOI_PROFILE=personal|work." >&2
    exit 1
    ;;
esac

banner_printed=false
print_banner_once() {
    if [ "$banner_printed" = false ]; then
        printf '\n\033[1;35m==> %s\033[0m\n' "Bootstrap prerequisite: Homebrew & password manager ($profile)" >&2
        banner_printed=true
    fi
}

warn_missing_self_service() {
    print_banner_once
    {
        echo "Work profile expects Keeper and Secretive to be installed via work Self Service, not Homebrew."
        echo "Install these from Self Service if missing:"
        echo "  - Keeper Password Manager"
        echo "  - Keeper Commander CLI (provides the 'keeper' command for chezmoi Keeper templates)"
        echo "  - Secretive (provides the Secure Enclave SSH agent)"
        echo "After installing Secretive, launch it and create a Secure Enclave SSH key with Command+N."
    } >&2
}

case "$(uname -s)" in
Darwin)
    if ! command -v brew >/dev/null 2>&1 && [[ ! -x "$BREW_PREFIX/bin/brew" ]]; then
        print_banner_once
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    eval "$("$BREW_PREFIX/bin/brew" shellenv)"

    if [ "$profile" = "work" ]; then
        missing_self_service=false

        if ! command -v keeper >/dev/null 2>&1; then
            missing_self_service=true
        elif ! keeper whoami </dev/null >/dev/null 2>&1; then
            print_banner_once
            {
                echo "Keeper Commander is installed but not signed in for non-interactive use."
                echo "Run 'keeper login' in an interactive terminal before rendering Keeper-backed templates."
            } >&2
        fi

        if [ ! -d "/Applications/Keeper Password Manager.app" ] && [ ! -d "$HOME/Applications/Keeper Password Manager.app" ]; then
            missing_self_service=true
        fi

        if [ ! -d "/Applications/Secretive.app" ] && [ ! -d "$HOME/Applications/Secretive.app" ]; then
            missing_self_service=true
        elif [ ! -S "$HOME/Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh" ]; then
            print_banner_once
            {
                echo "Secretive is installed, but its SSH agent socket is not present."
                echo "Launch Secretive or its SecretAgent login item."
            } >&2
        fi

        if [ "$missing_self_service" = true ]; then
            warn_missing_self_service
        fi
    else
        if ! brew list --cask 1password >/dev/null 2>&1; then
            print_banner_once
            brew install --cask 1password
        fi
        if ! brew list --cask 1password-cli >/dev/null 2>&1; then
            print_banner_once
            brew install --cask 1password-cli
        fi

        OP_BIN="$(command -v op || printf '%s/bin/op' "$BREW_PREFIX")"
        if [[ ! -x "$OP_BIN" ]]; then
            echo "1Password CLI is not installed or not executable: $OP_BIN" >&2
            exit 1
        fi

        accounts_file="$(mktemp)"
        trap 'rm -f "$accounts_file"' EXIT
        if ! "$OP_BIN" account list >"$accounts_file" 2>/dev/null || [[ ! -s "$accounts_file" ]]; then
            print_banner_once
            open -a '1Password' >/dev/null 2>&1 || true
            {
                echo "Be sure to setup your account(s) and vault(s) in 1Password."
                echo "Then go to 'Settings > Developer' and enable 'Integrate with 1Password CLI'."
                echo "Also go to 'Settings > Developer' and enable 'Use the SSH agent'."
            } >&2
            if [ -t 0 ]; then
                read -r -p "Press Enter to continue..."
            fi
        elif ! grep -q 'my.1password.com' "$accounts_file"; then
            "$OP_BIN" account add --address my.1password.com --email "adam@petrovic.com.au"
        fi

        "$OP_BIN" signin --account my >/dev/null || \
            echo "1Password sign-in did not complete; unlock 1Password and re-run chezmoi apply if secret reads fail" >&2
    fi
    ;;
*)
    echo "unsupported OS" >&2
    exit 1
    ;;
esac
