---
name: home-assistant
description: Control and query Home Assistant via its REST API. Use when the user asks about smart home devices, automations, entity states, climate control, lights, switches, sensors, scripts, scenes, or anything related to their Home Assistant instance.
---

# Home Assistant

## Setup

Requires `HASS_URL` and `HASS_TOKEN` environment variables. Never print or echo the token.

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

## Lovelace Dashboards

Dashboards use **storage mode** — config lives in `.storage/lovelace.*` files on the server. HA caches these in memory, so **editing the files on disk has no effect**. Use the websocket API instead.

### Reading dashboard config

```python
# Use the websocket helper script
python3 /Users/adam/.pi/agent/skills/home-assistant/scripts/lovelace.py get dashboard-mushroom
```

### Updating dashboard config

```python
# The script reads config, applies a Python expression, and saves via websocket
# The expression receives `config` (the full dashboard config dict) and must modify it in place

# Example: insert a card at position 3 in view 11
python3 /Users/adam/.pi/agent/skills/home-assistant/scripts/lovelace.py update dashboard-mushroom \
  'config["views"][11]["cards"][0]["cards"].insert(3, {"type": "custom:bubble-card", "card_type": "media-player", "entity": "media_player.sonos_eliza_bedroom"})'

# Example: change an entity reference
python3 /Users/adam/.pi/agent/skills/home-assistant/scripts/lovelace.py update dashboard-mushroom \
  'config["views"][0]["sections"][0]["cards"][3]["sub_button"][3]["tap_action"]["target"]["entity_id"] = "script.kids_eliza_play_white_noise"'
```

### Important

- **Never edit `.storage/lovelace.*` files directly** — HA's in-memory config will overwrite your changes on next save.
- Always use the websocket `lovelace/config/save` API (the helper script does this).
- Dashboard `url_path` values use hyphens (e.g. `dashboard-mushroom`), while storage file keys use dots (e.g. `lovelace.dashboard_mushroom`).

## Instance Details

- **Timezone:** Australia/Sydney (AEDT UTC+11 summer, AEST UTC+10 winter)
