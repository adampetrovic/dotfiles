{{ if .personal -}}
echo -n '{{ (onepasswordRead "op://Shared/Personal Password/password") }}' | sudo -vS
{{ else if .work -}}
echo -n '{{ (onepasswordRead "op://Shared/Work Password/password") }}' | sudo -vS
{{ end -}}

while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &