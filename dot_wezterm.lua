-- Pull in the wezterm API
local wezterm = require "wezterm"

local config = wezterm.config_builder()

config.default_prog = { "/bin/zsh" }
config.default_cwd = wezterm.home_dir

-- fonts
config.font = wezterm.font 'Jetbrains Mono'
config.font_size = 15
config.line_height = 1.1

-- config.color_scheme = 'Material Darker (base16)'
config.color_scheme = 'MaterialDarker'

config.window_decorations = "RESIZE"
config.default_cursor_style = "SteadyBar"
config.cursor_thickness = 3
config.enable_scroll_bar = true
config.show_new_tab_button_in_tab_bar = false
config.show_tab_index_in_tab_bar = false
config.show_tabs_in_tab_bar = false
config.window_close_confirmation = "NeverPrompt"

config.window_padding = {
  left = '1cell',
  right = '1cell',
  top = '0.5cell',
  bottom = '0',
}

config.window_frame = {
    font = wezterm.font({ family = 'Berkeley Mono Trial', weight = 'Bold' }),
    font_size = 11,
}

wezterm.on('update-status', function(window)
    local SOLID_LEFT_ARROW = utf8.char(0xe0b2)

    local color_scheme = window:effective_config().resolved_palette
    local bg = color_scheme.background
    local fg = color_scheme.foreground

    window:set_right_status(wezterm.format({
    -- First, we draw the arrow...
    { Background = { Color = 'none' } },
    { Foreground = { Color = bg } },
    { Text = SOLID_LEFT_ARROW },
    -- Then we draw our text
    { Background = { Color = bg } },
--config.font = wezterm.font("Jetbrains Mono")
    { Foreground = { Color = fg } },
    { Text = ' ' .. wezterm.hostname() .. ' ' },
  }))
end)

-- key bindings
config.leader = { key = 'a', mods = 'CTRL', timeout_milliseconds = 1000 }
config.keys = {
    {
        key = ',',
        mods = 'SUPER',
        action = wezterm.action.SpawnCommandInNewTab {
            cwd = wezterm.home_dir,
            args = { 'vim', wezterm.config_file },
        },
    },
    {
        key = 'a',
        mods = 'LEADER|CTRL',
        action = wezterm.action.SendKey { key = 'a', mods = 'CTRL' },
    },
    {
        -- I'm used to tmux bindings, so am using the quotes (") key to
        -- split horizontally, and the percent (%) key to split vertically.
        key = '"',
        -- Note that instead of a key modifier mapped to a key on your keyboard
        -- like CTRL or ALT, we can use the LEADER modifier instead.
        -- This means that this binding will be invoked when you press the leader
        -- (CTRL + A), quickly followed by quotes (").
        mods = 'LEADER',
        action = wezterm.action.SplitHorizontal { domain = 'CurrentPaneDomain' },
    },
    {
        key = '%',
        mods = 'LEADER',
        action = wezterm.action.SplitVertical { domain = 'CurrentPaneDomain' },
    },
    {
        -- I like to use vim direction keybindings, but feel free to replace
        -- with directional arrows instead.
        key = 'j', -- or DownArrow
        mods = 'LEADER',
        action = wezterm.action.ActivatePaneDirection('Down'),
    },
    {
        key = 'k', -- or UpArrow
        mods = 'LEADER',
        action = wezterm.action.ActivatePaneDirection('Up'),
    },
    {
        key = 'h', -- or LeftArrow
        mods = 'LEADER',
        action = wezterm.action.ActivatePaneDirection('Left'),
    },
    {
        key = 'l', -- or RightArrow
        mods = 'LEADER',
        action = wezterm.action.ActivatePaneDirection('Right'),
    },
}

-- code projects
local project_dir = wezterm.home_dir .. "/code"

local function project_dirs()
    -- start with homedir as a project
    local projects = { wezterm.home_dir }

    for _, dir in ipairs(wezterm.glob(project_dir .. '/*')) do
        table.insert(projects, dir)
    end

    return projects
end


return config
