---
name: surf
description: Control Chrome browser via CLI for testing, automation, and debugging. Use when the user needs browser automation, form filling, page inspection, network/CPU emulation, or DevTools streaming.
---

# Surf Browser Automation

Control Chrome browser via CLI or Unix socket.

## ⚡ Key Principles

1. **Text-first, screenshots-last** — Always use `page.read`, `page.text`, and `page.read --compact` to understand pages. Only take screenshots when you genuinely need to see visual layout, verify styling, or capture evidence.
2. **Refs for interaction** — Use `page.read --no-text --compact` to get element refs, then act on them directly. This is faster and cheaper than screenshots.
3. **Use `surf do` for multi-step tasks** — Chain commands in a single call instead of round-tripping through the LLM.
4. **No AI assistant features** — Do NOT use `surf chatgpt`, `surf gemini`, `surf perplexity`, `surf grok`, or `surf aistudio`. Use pi's own model for all reasoning and analysis.

## Core Workflow

```bash
# 1. Navigate
surf navigate "https://example.com"

# 2. Read page content as text (primary method)
surf page.text                 # Plain text content — fast, low token cost
surf page.read --compact       # Interactive elements with refs + text — best for interaction
surf page.read --no-text       # Just interactive elements — minimal output

# 3. Interact using refs from page.read
surf click --ref e5
surf type --text "hello"

# 4. Screenshot ONLY when visual verification is needed
surf screenshot --output /tmp/shot.png
```

## CLI Quick Reference

```bash
surf --help                    # Full help
surf <group>                   # Group help (tab, scroll, page, wait, dialog, emulate, form, perf)
surf --help-full               # All commands
surf --find <term>             # Search tools
surf --help-topic <topic>      # Topic guide (refs, semantic, frames, devices, windows)
```

## Page Reading (Preferred Over Screenshots)

```bash
surf page.text                 # Plain text content only — use for reading/extracting info
surf page.read --compact       # Accessibility tree with refs + text — use before interacting
surf page.read --no-text       # Interactive elements only — lightweight, use to find buttons/links/inputs
surf page.read                 # Full accessibility tree + text — verbose, use when you need everything
surf page.read --ref e5        # Inspect specific element
surf page.read --depth 3       # Limit tree depth
surf page.state                # Modals, loading state, scroll info
```

**When to use what:**
- **Reading an article/page content** → `surf page.text`
- **Need to click/fill/interact** → `surf page.read --no-text --compact` to get refs, then act
- **Debugging layout or verifying visual state** → `surf screenshot` (only then)

## Semantic Element Location

Find and act on elements by role, text, or label — no refs needed:

```bash
# Find by ARIA role
surf locate.role button --name "Submit" --action click
surf locate.role textbox --name "Email" --action fill --value "test@example.com"
surf locate.role link --all                    # Return all matches

# Find by text content
surf locate.text "Sign In" --action click
surf locate.text "Accept" --exact --action click

# Find form field by label
surf locate.label "Username" --action fill --value "john"
surf locate.label "Password" --action fill --value "secret"
```

**Actions:** `click`, `fill`, `hover`, `text` (get text content)

## Text Search

```bash
surf search "login"                    # Find text in page
surf search "Error" --case-sensitive   # Case-sensitive
surf search "button" --limit 5         # Limit results
```

## Tab Management

```bash
surf tab.list
surf tab.new "https://google.com"
surf tab.switch 12345
surf tab.close 12345
surf tab.reload

# Named tabs (aliases)
surf tab.name myapp
surf tab.switch myapp
surf tab.named
surf tab.unname myapp

# Tab groups
surf tab.group
surf tab.ungroup
surf tab.groups
```

## Window Management

```bash
surf window.list
surf window.list --tabs
surf window.new
surf window.new --url "https://example.com"
surf window.new --incognito
surf window.new --unfocused
surf window.focus 12345
surf window.close 12345
surf window.resize --id 123 --width 1920 --height 1080
surf window.resize --id 123 --state maximized
```

**Window isolation for agents:**
```bash
surf window.new "https://example.com"
surf --window-id 123 tab.list
surf --window-id 123 go "https://other.com"
```

## Input Methods

```bash
# CDP method (real events) - default
surf type --text "hello"
surf click --ref e5
surf click --x 100 --y 200

# JS method (DOM manipulation) - for contenteditable/rich editors
surf type --text "hello" --selector "#input" --method js

# Keys
surf key Enter
surf key "cmd+a"
surf key.repeat --key Tab --count 5

# Hover and drag
surf hover --ref e5
surf drag --from-x 100 --from-y 100 --to-x 200 --to-y 200
```

## Scrolling

```bash
surf scroll.bottom
surf scroll.top
surf scroll.to --y 500
surf scroll.to --ref e5        # Scroll element into view
surf scroll.by --y 200
surf scroll.info
```

## Waiting

```bash
surf wait 2                    # Wait N seconds
surf wait.element ".loaded"    # Wait for element
surf wait.network              # Wait for network idle
surf wait.url "/success"       # Wait for URL pattern
surf wait.dom --stable 100     # Wait for DOM stability
surf wait.load                 # Wait for page load complete
```

## Form Automation

```bash
surf page.read --no-text --compact   # Get refs first

# Fill by ref
surf form.fill --data '[{"ref":"e1","value":"John"},{"ref":"e2","value":"john@example.com"}]'

# Checkboxes
surf form.fill --data '[{"ref":"e7","value":true}]'

# Dropdown selection
surf select e5 "Option A"
surf select e5 "Option A" "Option B"         # Multi-select
surf select e5 --by label "Display Text"
surf select e5 --by index 2
```

## File Upload

```bash
surf upload --ref e5 --files "/path/to/file.txt"
surf upload --ref e5 --files "/path/file1.txt,/path/file2.txt"
```

## JavaScript Execution

```bash
surf js "return document.title"
surf js "document.querySelector('.btn').click()"
```

Useful for interacting with rich text editors, SPAs, or when you need to set values programmatically:
```bash
surf js "const el = document.querySelector('textarea'); el.value = 'text'; el.dispatchEvent(new Event('input', {bubbles:true})); return 'done'"
```

## Iframe Handling

```bash
surf frame.list
surf frame.switch "FRAME_ID"
surf frame.main                # Return to main frame
surf frame.js --id "FRAME_ID" --code "return document.title"
```

## Network Inspection

```bash
surf network                   # List captured requests
surf network --stream          # Real-time network events
surf network.get --id "req-123"   # Full request details
surf network.body --id "req-123"  # Get response body
surf network.curl --id "req-123"  # Generate curl command
surf network.origins           # List origins with stats
surf network.stats             # Capture statistics
surf network.export            # Export all requests
surf network.clear             # Clear captured requests
```

## Console

```bash
surf console                   # Get console messages
surf console --stream          # Real-time console
surf console --stream --level error
```

## Screenshots (Use Sparingly)

Only use when you need to verify visual layout, capture evidence, or debug rendering.

```bash
surf screenshot                           # Auto-saves to /tmp/surf-snap-*.png
surf screenshot --output /tmp/shot.png
surf screenshot --selector ".card"        # Element only
surf screenshot --full-page               # Full page scroll capture
surf screenshot --no-save                 # Return base64 only
```

## Device/Network Emulation

```bash
surf emulate.network slow-3g   # Presets: slow-3g, fast-3g, 4g, offline
surf emulate.network reset
surf emulate.cpu 4             # 4x slower
surf emulate.cpu 1             # Reset
surf emulate.device "iPhone 14"
surf emulate.device --list
surf emulate.viewport --width 1280 --height 720
surf emulate.touch --enable
surf emulate.geo --lat 37.7749 --lon -122.4194
surf emulate.geo --clear
```

## Element Inspection

```bash
surf element.styles e5         # Computed styles by ref
surf element.styles ".card"    # Or by CSS selector
```

## Dialog Handling

```bash
surf dialog.info
surf dialog.accept
surf dialog.accept --text "response"
surf dialog.dismiss
```

## Cookies & Storage

```bash
surf cookie.list
surf cookie.list --domain .google.com
surf cookie.set --name "token" --value "abc123"
surf cookie.get --name "token"
surf cookie.clear
```

## History & Bookmarks

```bash
surf history --query "github" --max 20
surf bookmarks --query "docs"
surf bookmark.add --url "https://..." --title "My Bookmark"
surf bookmark.remove
```

## Health Checks & Smoke Tests

```bash
surf health --url "http://localhost:3000"
surf smoke --urls "http://localhost:3000" "http://localhost:3000/about"
surf smoke --urls "..." --screenshot /tmp/smoke
```

## Workflows (`surf do`)

Execute multi-step browser automation as a single command with smart auto-waits.

```bash
# Pipe-separated inline commands
surf do 'go "https://example.com" | click e5 | screenshot'

# Multi-step login
surf do 'go "https://example.com/login" | type "user@example.com" --selector "#email" | type "pass" --selector "#password" | click --selector "button[type=submit]"'

# Validate without executing
surf do 'go "url" | click e5' --dry-run
```

### Named Workflows

Save as JSON in `~/.surf/workflows/` (user) or `./.surf/workflows/` (project):

```bash
surf workflow.list
surf workflow.info my-workflow
surf do my-workflow --email "user@example.com" --password "secret"
surf workflow.validate workflow.json
```

### Workflow Options

```bash
--file, -f <path>     # Load from JSON file
--dry-run             # Validate without executing
--on-error stop|continue
--step-delay <ms>     # Delay between steps (default: 100)
--no-auto-wait        # Disable automatic waits
--json                # Structured JSON output
```

## Zoom

```bash
surf zoom              # Get current zoom
surf zoom 1.5          # Set 150%
surf zoom 1            # Reset
```

## Performance

```bash
surf perf.metrics
surf perf.start
surf perf.stop
```

## Error Diagnostics

```bash
surf wait.element ".missing" --auto-capture --timeout 2000
# Saves screenshot + console to /tmp/surf-error-*.png on failure
```

## Common Options

```bash
--tab-id <id>         # Target specific tab
--window-id <id>      # Target specific window
--json                # Raw JSON output
--auto-capture        # Screenshot + console on error
--timeout <ms>        # Override default timeout
```

## Tips

1. **Text first** — `page.text` and `page.read --compact` before reaching for screenshots
2. **First CDP operation is slow** (~5-8s) — debugger attachment overhead, subsequent calls fast
3. **Use refs from page.read** for reliable element targeting over CSS selectors
4. **JS method for rich editors** — CodeMirror, Monaco, contenteditable need `--method js` or direct `surf js`
5. **Named tabs for workflows** — `tab.name app` then `tab.switch app`
6. **Auto-capture for debugging** — `--auto-capture` saves diagnostics on failure
7. **Use `surf do` for multi-step tasks** — Reduces token overhead and improves reliability
8. **Dry-run workflows first** — `surf do '...' --dry-run` validates without executing
9. **Window isolation** — `window.new` + `--window-id` keeps agent work separate from user browsing
10. **Semantic locators** — `locate.role`, `locate.text`, `locate.label` for robust element finding
11. **Frame context** — Use `frame.switch` before interacting with iframe content

## Socket API

For programmatic access:

```bash
echo '{"type":"tool_request","method":"execute_tool","params":{"tool":"tab.list","args":{}},"id":"1"}' | nc -U /tmp/surf.sock
```
