-- Pull in the wezterm API
local wezterm = require("wezterm")

local config = wezterm.config_builder()

--config.font = wezterm.font("Jetbrains Mono")
config.font = wezterm.font({
	family = "Jetbrains Mono"
})

config.font_size = 15
config.line_height = 1

config.enable_tab_bar = false
config.window_decorations = "RESIZE"
config.default_cursor_style = "SteadyBar"
config.cursor_thickness = 3

config.default_cwd = wezterm.home_dir

--config.color_scheme = 'Github Dark'
--config.color_scheme = 'Gruvbox'
config.color_scheme = 'Material Darker (base16)'

config.enable_scroll_bar = true

--config.colors = {
	--foreground = "#CBE0F0",
	--background = "#011423",
	--cursor_bg = "#47FF9C",
	--cursor_border = "#47FF9C",
	--cursor_fg = "#011423",
	--selection_bg = "#033259",
	--selection_fg = "#CBE0F0",
	--ansi = { "#214969", "#E52E2E", "#44FFB1", "#FFE073", "#0FC5ED", "#a277ff", "#24EAF7", "#24EAF7" },
	--brights = { "#214969", "#E52E2E", "#44FFB1", "#FFE073", "#A277FF", "#a277ff", "#24EAF7", "#24EAF7" },
--}

return config
