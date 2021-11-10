let g:ctrlp_map = '<c-p>'
let g:ctrlp_cmd = 'CtrlP'
let g:ctrlp_use_caching = 1 
let g:ctrlp_show_hidden = 1 
let g:ctrlp_follow_symlinks = 1 
let g:ctrlp_clear_cache_on_exit = 0 
let g:ctrlp_max_height = 20
let g:ctrlp_max_files = 0 
let g:ctrlp_working_path_mode = 'ra'
let g:ctrlp_custom_ignore = { 
  \ 'dir':  '\v[\/]\.(git|hg|cover|svn|gen-py|gen-go|gen-php|tox|egg-info|build)$',
  \ 'file': '\v\.(exe|so|dll|pyc)$',
  \ }

