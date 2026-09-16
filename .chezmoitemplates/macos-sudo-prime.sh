{{ if .personal -}}
echo -n '{{ (onepasswordRead "op://Shared/Personal Password/password") }}' | sudo -vS
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
{{ else if .work -}}
{{ template "work-sudo.sh" . }}
sudo -v
{{ end -}}
