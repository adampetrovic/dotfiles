-- Basic Neovim config. Add plugins/panels incrementally.
vim.g.mapleader = ","
vim.g.markdown_recommended_style = 0 -- keep our own indent settings for markdown

local o = vim.opt
o.number = true
o.relativenumber = true
o.expandtab = true
o.shiftwidth = 2
o.tabstop = 2
o.ignorecase = true
o.smartcase = true
o.termguicolors = true
o.clipboard = "unnamedplus"
o.wrap = true
o.linebreak = true
o.undofile = true
o.signcolumn = "yes"

-- Plugins (lazy.nvim, bootstrapped on first run)
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
  vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable",
    "https://github.com/folke/lazy.nvim.git", lazypath })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  {
    -- Same theme as ~/.vim: material, darker style
    "kaicataldo/material.vim",
    lazy = false,
    priority = 1000,
    config = function()
      vim.o.background = "dark"
      vim.g.material_theme_style = "darker"
      vim.cmd.colorscheme("material")
    end,
  },
  {
    -- Logseq-like rendering: dot bullets, checkboxes, headings, inline code
    "MeanderingProgrammer/render-markdown.nvim",
    ft = "markdown",
    opts = {
      render_modes = true, -- keep rendering in insert mode too
      bullet = { icons = { "●", "○", "◆", "◇" } },
      checkbox = {
        unchecked = { icon = "󰄱 " },
        checked = { icon = "󰱒 " },
        custom = {
          todo = { raw = "[-]", rendered = "󰥔 ", highlight = "RenderMarkdownTodo" },
        },
      },
      heading = { sign = false },
      anti_conceal = { enabled = true }, -- raw text on the cursor line
    },
  },
  { "nvim-tree/nvim-web-devicons", lazy = true },
  { "nvim-lua/plenary.nvim", lazy = true },
  {
    "nvim-lualine/lualine.nvim",
    opts = { options = { theme = "auto", globalstatus = true } },
  },
  {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    opts = { scope = { enabled = false } },
  },
  {
    -- Works on jj colocated repos (they have a .git) as well as plain git
    "lewis6991/gitsigns.nvim",
    opts = {},
  },
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = { "nvim-lua/plenary.nvim", "nvim-tree/nvim-web-devicons", "MunifTanjim/nui.nvim" },
    cmd = "Neotree",
    keys = { { "<leader>e", "<cmd>Neotree toggle<cr>", desc = "File tree" } },
    opts = { filesystem = { follow_current_file = { enabled = true } } },
  },
  {
    "nvim-telescope/telescope.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
    cmd = "Telescope",
    keys = {
      { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find files" },
      { "<leader>fg", "<cmd>Telescope live_grep<cr>", desc = "Grep" },
      { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Buffers" },
    },
  },
}, { rocks = { enabled = false } })

-- Logseq-style outline editing for markdown
vim.api.nvim_create_autocmd("FileType", {
  pattern = "markdown",
  callback = function()
    local map = function(mode, lhs, rhs) vim.keymap.set(mode, lhs, rhs, { buffer = true }) end
    vim.opt_local.conceallevel = 2
    vim.opt_local.autoindent = false -- the <CR> mapping below copies the bullet indent itself
    -- Logseq indents nested blocks with tabs; spaces show up an extra level deep there
    if vim.fn.expand("%:p"):find(vim.fn.expand("~/code/logseq"), 1, true) == 1 then
      vim.opt_local.expandtab = false
      vim.opt_local.tabstop = 2
      vim.opt_local.shiftwidth = 2
    end
    vim.opt_local.foldmethod = "indent"
    vim.opt_local.foldlevel = 99
    vim.keymap.set("i", "<CR>", function()
      local line = vim.api.nvim_get_current_line()
      local indent = line:match("^(%s*)%- ")
      local keys
      if not indent then
        keys = "<CR>"
      elseif line:match("^%s*%- $") then
        keys = "<C-u>"
      else
        keys = "<CR>" .. indent .. "- "
      end
      -- noremap + insert-at-front so literal tabs aren't re-mapped to <Tab>
      vim.api.nvim_feedkeys(vim.keycode(keys), "ni", false)
    end, { buffer = true })
    map("i", "<Tab>", "<C-t>")
    map("i", "<S-Tab>", "<C-d>")
    map("n", "<Tab>", ">>")
    map("n", "<S-Tab>", "<<")
  end,
})

-- Logseq syntax: [[links]], #tags, TODO/DONE markers, key:: properties
local function set_hl()
  local hl = vim.api.nvim_set_hl
  hl(0, "LogseqLink", { link = "Function", default = true })
  hl(0, "LogseqTag", { link = "Keyword", default = true })
  hl(0, "LogseqProp", { link = "Comment", default = true })
  hl(0, "LogseqTodo", { link = "Todo", default = true })
  hl(0, "LogseqDoing", { link = "WarningMsg", default = true })
  hl(0, "LogseqDone", { link = "String", default = true })
  hl(0, "LogseqCancel", { link = "Comment", default = true })
end
set_hl()
vim.api.nvim_create_autocmd("ColorScheme", { callback = set_hl })

local logseq_matches = {
  { "LogseqLink", [=[\v#?\[\[[^\]]+\]\]]=] },
  { "LogseqTag", [=[\v(^|\s)\zs#[A-Za-z0-9_/-]+]=] },
  { "LogseqProp", [=[\v^\s*(- )?\zs[A-Za-z0-9_-]+::]=] },
  { "LogseqTodo", [=[\C\v<(TODO|NOW|LATER|WAITING)>]=] },
  { "LogseqDoing", [=[\C\v<(DOING|IN-PROGRESS)>]=] },
  { "LogseqDone", [=[\C\v<DONE>]=] },
  { "LogseqCancel", [=[\C\v<(CANCELED|CANCELLED)>]=] },
}

vim.api.nvim_create_autocmd({ "BufWinEnter", "FileType" }, {
  pattern = "*.md",
  callback = function()
    if vim.w.logseq_matches then return end
    vim.w.logseq_matches = true
    for _, m in ipairs(logseq_matches) do vim.fn.matchadd(m[1], m[2], 20) end
  end,
})

-- Follow [[link]] under cursor (gf / <CR>) within the Logseq graph
local graph = vim.fn.expand("~/code/logseq")
local function follow_link()
  local line, col = vim.api.nvim_get_current_line(), vim.fn.col(".")
  local init = 1
  while true do
    local s, e, name = line:find("%[%[([^%]]+)%]%]", init)
    if not s then break end
    if col >= s and col <= e then
      local file
      local y, m, d = name:match("^(%d%d%d%d)-(%d%d)-(%d%d)$")
      if y then
        file = ("%s/journals/%s_%s_%s.md"):format(graph, y, m, d)
      else
        file = ("%s/pages/%s.md"):format(graph, name:gsub("/", "___"))
      end
      vim.cmd.edit(vim.fn.fnameescape(file))
      return
    end
    init = e + 1
  end
  vim.cmd("normal! gf")
end
vim.api.nvim_create_autocmd("FileType", {
  pattern = "markdown",
  callback = function()
    vim.keymap.set("n", "gf", follow_link, { buffer = true, desc = "Follow [[link]]" })
    vim.keymap.set("n", "<BS>", "<C-o>", { buffer = true, desc = "Back" })
  end,
})
