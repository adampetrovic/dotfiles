---
name: 1password
description: Read secrets, credentials, and metadata from 1Password via the `op` CLI. Use when the user asks about passwords, API keys, secrets, credentials, login details, or needs to look up items stored in 1Password. Also use when setting up integrations that require secrets from 1Password.
---

# 1Password CLI

Read secrets and credentials from 1Password using the `op` CLI. Requires the 1Password desktop app to be running and unlocked with CLI integration enabled.

## Prerequisites

- 1Password desktop app installed, running, and unlocked
- CLI integration enabled: 1Password → Settings → Developer → "Integrate with 1Password CLI"
- `op` CLI installed (`brew install 1password-cli`)

## Operating Rules

- **Never log, print, or expose secrets** in chat, code, or files. Use `op read` or `op run` to inject secrets at runtime.
- **Prefer `op run` / `op inject`** over writing secrets to disk.
- **Verify access first**: run `op whoami` before attempting any secret reads.
- **If sign-in fails**: ask the user to unlock the 1Password desktop app, then retry.
- **Use secret references** (`op://vault/item/field`) instead of raw values wherever possible.

## Quick Start

```bash
# Verify CLI and auth
op --version
op whoami

# List vaults
op vault list

# List items in a vault
op item list --vault Personal

# Search for items
op item list --tags api-key
op item list | grep -i "github"
```

## Reading Secrets

```bash
# Read a specific field
op read "op://Personal/GitHub/password"
op read "op://Personal/AWS/access key id"

# Read OTP
op read "op://Personal/GitHub/one-time password?attribute=otp"

# Read SSH key
op read "op://Personal/ssh key/private key?ssh-format=openssh"

# Save to file (e.g., SSH key, certificate)
op read --out-file ./key.pem "op://Personal/server/ssh/key.pem"
```

## Running Commands with Secrets

```bash
# Inject secrets as env vars for a command
export DB_PASSWORD="op://app-prod/db/password"
op run -- printenv DB_PASSWORD

# Use an env file template
op run --env-file="./.env" -- ./start-server.sh
```

## Injecting Secrets into Templates

```bash
# Pipe template through op inject
echo "api_key: {{ op://Personal/API/key }}" | op inject

# File-based injection
op inject -i config.yml.tpl -o config.yml
```

## Item Management

```bash
# Get full item details (JSON)
op item get "GitHub" --vault Personal --format json

# Get specific field
op item get "GitHub" --vault Personal --fields password

# List all items
op item list --vault Personal --format json

# Search by tag
op item list --tags dev --format json
```

## Account Management

```bash
# List accounts
op account list

# Sign in to specific account
op signin --account my.1password.com

# Check current session
op whoami
```

## References

- `references/get-started.md` — Installation and desktop app integration setup
- `references/cli-examples.md` — Complete `op` CLI command examples
