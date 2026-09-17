#!/bin/bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "unsupported OS" >&2
    exit 1
fi

profile="${1:-}"
email="${2:-}"
if [[ "$profile" != "personal" && "$profile" != "work" ]]; then
    echo "Usage: $0 personal|work [email]" >&2
    exit 1
fi

if [[ "$(uname -m)" == "arm64" ]]; then
    brew_prefix="/opt/homebrew"
else
    brew_prefix="/usr/local"
fi

banner_printed=false
print_banner_once() {
    if [[ "$banner_printed" == false ]]; then
        printf '\n\033[1;35m==> %s\033[0m\n' "Bootstrap prerequisite: Homebrew & password manager ($profile)" >&2
        banner_printed=true
    fi
}

warn() {
    print_banner_once
    printf '%s\n' "$@" >&2
}

app_installed() {
    [[ -d "/Applications/$1.app" || -d "$HOME/Applications/$1.app" ]]
}

warn_missing_self_service() {
    warn \
        "Work profile expects Keeper and Secretive to be installed via work Self Service, not Homebrew." \
        "Install these from Self Service if missing:" \
        "  - Keeper Password Manager" \
        "  - Keeper Commander CLI (provides the 'keeper' command for chezmoi Keeper templates)" \
        "  - Secretive (provides the Secure Enclave SSH agent)" \
        "After installing Secretive, launch it and create a Secure Enclave SSH key with Command+N."
}

if ! command -v brew >/dev/null 2>&1 && [[ ! -x "$brew_prefix/bin/brew" ]]; then
    print_banner_once
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$("$brew_prefix/bin/brew" shellenv)"

if [[ "$profile" == "work" ]]; then
    if ! command -v keeper >/dev/null 2>&1 || \
        ! app_installed "Keeper Password Manager" || \
        ! app_installed "Secretive"; then
        warn_missing_self_service
    fi

    if command -v keeper >/dev/null 2>&1 && ! keeper whoami </dev/null >/dev/null 2>&1; then
        warn \
            "Keeper Commander is installed but not signed in for non-interactive use." \
            "Run 'keeper login' in an interactive terminal before rendering Keeper-backed templates."
    fi

    secretive_socket="$HOME/Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh"
    if app_installed "Secretive" && [[ ! -S "$secretive_socket" ]]; then
        warn \
            "Secretive is installed, but its SSH agent socket is not present." \
            "Launch Secretive or its SecretAgent login item."
    fi

    exit 0
fi

for cask in 1password 1password-cli; do
    if ! brew list --cask "$cask" >/dev/null 2>&1; then
        print_banner_once
        brew install --cask "$cask"
    fi
done

op_bin="$(command -v op || printf '%s/bin/op' "$brew_prefix")"
if [[ ! -x "$op_bin" ]]; then
    echo "1Password CLI is not installed or not executable: $op_bin" >&2
    exit 1
fi

accounts=""
if ! accounts="$("$op_bin" account list 2>/dev/null)" || [[ -z "$accounts" ]]; then
    print_banner_once
    open -a '1Password' >/dev/null 2>&1 || true
    warn \
        "Be sure to set up your account(s) and vault(s) in 1Password." \
        "Then go to 'Settings > Developer' and enable 'Integrate with 1Password CLI'." \
        "Also go to 'Settings > Developer' and enable 'Use the SSH agent'."
    if [[ -t 0 ]]; then
        read -r -p "Press Enter to continue..."
    fi
elif [[ "$accounts" != *my.1password.com* ]]; then
    if [[ -z "$email" ]]; then
        echo "An email argument is required to add the 1Password account." >&2
        exit 1
    fi
    "$op_bin" account add --address my.1password.com --email "$email"
fi

"$op_bin" signin --account my >/dev/null || \
    echo "1Password sign-in did not complete; unlock 1Password and re-run chezmoi apply if secret reads fail" >&2
