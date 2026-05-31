{{ if .personal -}}
echo -n '{{ (onepasswordRead "op://Shared/Personal Password/password") }}' | sudo -vS
{{ else if .work -}}
sudo -v
{{ end -}}

while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &