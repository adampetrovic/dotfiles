" w!! forces writing as sudo when insufficient priveleges
cmap w!! %!sudo tee > /dev/null %

" show git diff in vsplit with git commit
autocmd FileType gitcommit DiffGitCached | wincmd L | wincmd p

" show jj diff in vsplit with jj describe  
autocmd FileType jjdescription JJDiff | wincmd L | wincmd p | wincmd L

" strip trailing whitespace on save
autocmd FileType c,cpp,python,ruby,java,php autocmd BufWritePre <buffer> :%s/\s\+$//e

if has('persistent_undo')
    set undofile
    set undodir=~/.config/vim/tmp/undo/
endif

" Autocorrect words / spelling mistakes
iab teh the
iab Teh The

" george doesn't use vim
