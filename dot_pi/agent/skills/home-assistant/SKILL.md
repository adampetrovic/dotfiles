---
name: home-assistant
description: Control and query Home Assistant via its REST API. Use when the user asks about smart home devices, automations, entity states, climate control, lights, switches, sensors, scripts, scenes, or anything related to their Home Assistant instance.
---

# Home Assistant

## Setup

Requires `HASS_URL` and `HASS_TOKEN` environment variables. Never print or echo the token.

In the `hass-config` repo, these are defined in `.mise.toml` and auto-loaded by mise. For non-interactive shells, load them with:

```bash
eval "$(mise env 2>/dev/null)" || true
```

The repo wrapper scripts (`scripts/ha-deploy`, `scripts/ha-dash`) handle this automatically.

## CLI Tool

Path: `scripts/ha.sh` (relative to this skill directory)

```bash
HA="/Users/adam/.pi/agent/skills/home-assistant/scripts/ha.sh"
```

### Discovery (start here when entity IDs are unknown)

```bash
$HA states --search "bedroom"               # Search by name/id
$HA states --domain climate                  # Filter by domain
$HA state sensor.living_room_temperature     # Full JSON for one entity
$HA entities sensor                          # List domain entities via template
$HA areas                                    # List all areas
$HA climate                                  # Climate entities with key attributes
```

### Control

```bash
$HA call <domain> <service> --data '{"entity_id":"...","key":"value"}'
$HA call climate set_temperature --data '{"entity_id":"climate.ac","temperature":23}'
$HA call light turn_on --data '{"entity_id":"light.lounge","brightness":200}'
```

### History & Templates

```bash
$HA history <entity_id> --hours 6
$HA template '{{ states("sensor.temperature") }}'
$HA template '{% for e in area_entities("living_room") %}{{ e }}: {{ states(e) }}\n{% endfor %}'
```

### Other: `services [domain]`, `automations`, `scenes`, `scripts`, `input-helpers`, `logbook`, `error-log`, `check-config`, `fire-event`

Run `$HA help` for the full command list.

## Rules

1. **Discover first** — search for entities before assuming IDs exist.
2. **Confirm before acting** — show the user the service call before changing device state. Reads don't need confirmation.
3. **Verify after acting** — check state after service calls to confirm they took effect.
4. **Template is the power tool** — `$HA template` runs Jinja2 server-side with full access to HA internals (areas, devices, entity registry, computed values). Use it when REST endpoints aren't enough.

## Websocket API

For operations not covered by the REST API (entity/device/area registry, labels, search), use the websocket helper:

```bash
WS="/Users/adam/.pi/agent/skills/home-assistant/scripts/ws.py"
```

### Entity Registry

```bash
# Rename an entity's friendly name
python3 $WS '{"type": "config/entity_registry/update", "entity_id": "scene.master_bedroom_4_chill", "name": "Master Bedroom Lights Chill"}'

# Get entity registry entry (shows name, area, labels, device, etc.)
python3 $WS '{"type": "config/entity_registry/get", "entity_id": "light.kitchen"}'

# Set icon, area, or disable an entity
python3 $WS '{"type": "config/entity_registry/update", "entity_id": "light.kitchen", "icon": "mdi:ceiling-light", "area_id": "kitchen"}'

# List all entity registry entries (large output — prefer get for single entities)
python3 $WS '{"type": "config/entity_registry/list"}'
```

### Device & Area Registry

```bash
# List all areas
python3 $WS '{"type": "config/area_registry/list"}'

# Create an area
python3 $WS '{"type": "config/area_registry/create", "name": "My Room"}'

# Rename a device
python3 $WS '{"type": "config/device_registry/update", "device_id": "abc123", "name_by_user": "My Device"}'
```

### Label Registry

```bash
# List labels
python3 $WS '{"type": "config/label_registry/list"}'

# Create a label
python3 $WS '{"type": "config/label_registry/create", "name": "Climate", "icon": "mdi:thermostat", "color": "cyan"}'
```

### Search Related

```bash
# Find all entities/devices/areas/automations related to an entity
python3 $WS '{"type": "search/related", "item_type": "entity", "item_id": "light.kitchen"}'
```

Run `python3 $WS --help` for the full list of common message types.

## Lovelace Dashboards

Dashboards use **storage mode** — config lives in `.storage/lovelace.*` files on the server. HA caches these in memory, so **editing the files on disk has no effect**. Use the websocket API instead.

### Dashboard helper (preferred)

The `hass-config` repo has a wrapper script that loads env vars and defaults to the main dashboard (`dashboard-mushroom`):

```bash
# List all views with indices
./scripts/ha-dash list

# Dump a single view as JSON
./scripts/ha-dash get 7

# Update a view (Python expression — mutate `config` in place)
./scripts/ha-dash update 'config["views"][7] = { "type": "panel", ... }'

# Insert a card
./scripts/ha-dash update 'config["views"][5]["cards"][0]["cards"].insert(3, {"type": "custom:bubble-card"})'

# Target a different dashboard (rarely needed)
./scripts/ha-dash --dashboard lovelace list
```

### Low-level lovelace.py (for use outside the repo)

```bash
python3 /Users/adam/.pi/agent/skills/home-assistant/scripts/lovelace.py get dashboard-mushroom
python3 /Users/adam/.pi/agent/skills/home-assistant/scripts/lovelace.py update dashboard-mushroom 'config["views"][7] = {...}'
```

### Important

- **The main dashboard is `dashboard-mushroom`** — not the default `lovelace` (which is legacy).
- **Never edit `.storage/lovelace.*` files directly** — HA's in-memory config will overwrite your changes on next save.
- Always use the websocket `lovelace/config/save` API (which `ha-dash` and `lovelace.py` wrap).
- Dashboard `url_path` values use hyphens (e.g. `dashboard-mushroom`), while storage file keys use dots (e.g. `lovelace.dashboard_mushroom`).

## Instance Details

- **Timezone:** Australia/Sydney (AEDT UTC+11 summer, AEST UTC+10 winter)
