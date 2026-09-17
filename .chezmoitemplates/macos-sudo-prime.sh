{{ if .personal -}}
_CHEZMOI_SUDO_PASSWORD={{ onepasswordRead "op://Shared/Personal Password/password" | quote }}
printf '%s\n' "$_CHEZMOI_SUDO_PASSWORD" | sudo -vS
# Personal machines permit refreshing the sudo timestamp while this script runs.
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
{{ else if .work -}}
# Work policy disables sudo timestamp caching, so each sudo call supplies the password.
{{ template "work-sudo.sh" . }}
sudo -v
{{ end -}}
