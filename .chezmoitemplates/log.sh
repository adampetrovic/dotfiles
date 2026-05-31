if [ -t 1 ]; then
    _c0=$'\033[0m'; _cstep=$'\033[1;35m'; _cok=$'\033[1;32m'; _cwarn=$'\033[1;33m'; _cinfo=$'\033[0;36m'
else
    _c0=''; _cstep=''; _cok=''; _cwarn=''; _cinfo=''
fi
log_step() { printf '\n%s==> %s%s\n' "$_cstep" "$*" "$_c0"; }
log_info() { printf '%s    %s%s\n' "$_cinfo" "$*" "$_c0"; }
log_ok()   { printf '%s  ✓ %s%s\n' "$_cok" "$*" "$_c0"; }
log_warn() { printf '%s  ! %s%s\n' "$_cwarn" "$*" "$_c0"; }
