" Set <leader> to ,
let mapleader = ","

" Buffer keybind
nmap <C-e> :e#<CR>

" Map ,/ to toggle search highlighting
noremap <silent><Leader>/ :nohls<CR>

" Map ,cf to find conflict markers
nmap <silent> <leader>cf <ESC>/\v^[<=>]{7}( .*\|$)<CR>

" ;; = escape key
inoremap ;; <esc>

" ROT13 key binding
map <F12> ggVGg?

" Fix indenting without moving cursor
noremap <F1> mzgg=G`zzz

" Turn off arrow keys
nnoremap <up> <nop>
nnoremap <down> <nop>
nnoremap <left> <nop>
nnoremap <right> <nop>

" F8 is paste toggle
set pastetoggle=<F8>

" Reselect visual block after indent / outdent
vnoremap < <gv
vnoremap > >gv

" Improve up / down movement
nnoremap j gj
nnoremap k gk

" Golang Mappings
au FileType go nmap <Leader>i <Plug>(go-info)
au FileType go nmap <Leader>gd <Plug>(go-doc)
au FileType go nmap <Leader>r <Plug>(go-run)
au FileType go nmap <Leader>b <Plug>(go-build)
au FileType go nmap <Leader>t <Plug>(go-test)
au FileType go nmap gd <Plug>(go-def-tab)
