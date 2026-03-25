set background=dark " Nicer colour scheme for darker terminal backgrounds

set t_Co=256                      " Make vim aware of 256 colorspace
colorscheme material
let g:material_theme_style='darker' " Material darker colorscheme

if (has('termguicolors'))
  set termguicolors                 " needed for line numbers to show
endif

syntax enable " syntax highlighting
filetype plugin indent on

set number " Line Numbering
set nofoldenable
set nowrap " Do not line wrap by default
set ruler
set autoindent
set smartindent
set nocompatible " Disable vim compatibility
set laststatus=2 " Always show the statusline
set encoding=utf-8 " Unicode glyphs!

set expandtab " No real tabs!
set shiftwidth=4
set softtabstop=4
set tabstop=4 " 4 spaces

set backspace=indent,eol,start
set copyindent
set clipboard=unnamed " Yank into system register
set showmatch
set showmode
set ignorecase " Turn off case
set smartcase
set smarttab
set hlsearch " Highlight matched strings
set incsearch " Highlight search as you type
set nobackup " Don't save any periodic backups
set noswapfile " Don't save a swapfile
set lazyredraw " Do not redraw while running macros
set history=1000
set noerrorbells " No unneccesary noise
set statusline=%F%m%r%h%w[%L][%{&ff}]%y[%p%%][%04l,%04v]
set wildignore=*/tmp/*,*.o,*.class,*.pyc,*.so,*.swp,*.zip,*/build/*,*.pdf
