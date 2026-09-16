_CHEZMOI_SUDO_PASSWORD={{ keeperFindPassword "Work Mac Login" | quote }}

sudo() {
    printf '%s\n' "$_CHEZMOI_SUDO_PASSWORD" | /usr/bin/sudo -S -p '' "$@"
}

run_with_sudo_password() {
    local expect_script
    local status
    expect_script="$(mktemp "${TMPDIR:-/tmp}/chezmoi-sudo.XXXXXX")"
    chmod 600 "$expect_script"
    cat >"$expect_script" <<'EXPECT'
log_user 1
set timeout -1
if {[gets stdin password] < 0} {
    exit 1
}
spawn -noecho {*}$argv
expect {
    -nocase -re {password:[[:space:]]*$} {
        send -- "$password\r"
        exp_continue
    }
    eof
}
set result [wait]
exit [lindex $result 3]
EXPECT

    if printf '%s\n' "$_CHEZMOI_SUDO_PASSWORD" | /usr/bin/expect "$expect_script" "$@"; then
        status=0
    else
        status=$?
    fi
    rm -f "$expect_script"
    return "$status"
}
