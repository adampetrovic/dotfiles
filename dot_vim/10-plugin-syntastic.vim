let g:syntastic_always_populate_loc_list = 1 
let g:syntastic_python_checkers = ['flake8']
let g:syntastic_python_flake8_exec = 'flake8'
let g:loaded_syntastic_python_mypy_checker = 1

let g:syntastic_go_checkers = ['golint', 'govet', 'errcheck']
let g:syntastic_mode_map = { 'mode': 'active', 'passive_filetypes': ['go'] }
