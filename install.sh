#!/usr/bin/env bash

set -e

die () {
    echo >&2 "$@"
    exit 1
}

[ "$#" -eq 1 ] || die "Please provide a config to apply. {personal, server, work}"

BASE_CONFIG="base"
CONFIG_SUFFIX=".yaml"

META_DIR="meta"
CONFIG_DIR="configs"
PROFILES_DIR="profiles"

DOTBOT_DIR="dotbot"
DOTBOT_BIN="bin/dotbot"

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


cd "${BASE_DIR}"
git submodule update --init --recursive --remote

if [ ! -f "${META_DIR}/${PROFILES_DIR}/$1" ]; then
    die "Profile '$1' not found."
fi

while IFS= read -r config; do
    CONFIGS+=" ${config}"
done < "${META_DIR}/${PROFILES_DIR}/$1"

echo $1 > /tmp/.dotfiles-profile
shift

for config in ${CONFIGS} ${@}; do
    echo -e "\nConfigure $config"
    configContent="$(<"${BASE_DIR}/${META_DIR}/${BASE_CONFIG}${CONFIG_SUFFIX}")\n$(<"${BASE_DIR}/${META_DIR}/${CONFIG_DIR}/${config}${CONFIG_SUFFIX}")"
    "${BASE_DIR}/${META_DIR}/${DOTBOT_DIR}/${DOTBOT_BIN}" -d "${BASE_DIR}" --plugin-dir ${META_DIR}/dotbot-brew -c <(echo -e "$configContent")
done
rm /tmp/.dotfiles-profile
