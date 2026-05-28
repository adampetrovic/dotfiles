#!/usr/bin/env bash
set -Eeuo pipefail

# ──────────────────────────────────────────────────────────────
# ha.sh — Home Assistant REST API CLI wrapper
# ──────────────────────────────────────────────────────────────
# Requires: HASS_URL, HASS_TOKEN environment variables
# Requires: curl, jq
# ──────────────────────────────────────────────────────────────

readonly SCRIPT_NAME="$(basename "$0")"

# ── Validation ───────────────────────────────────────────────

check_env() {
    local missing=()
    [[ -z "${HASS_URL:-}" ]] && missing+=("HASS_URL")
    [[ -z "${HASS_TOKEN:-}" ]] && missing+=("HASS_TOKEN")
    if (( ${#missing[@]} > 0 )); then
        echo "ERROR: Missing required environment variables: ${missing[*]}" >&2
        echo "  HASS_URL   = Home Assistant base URL (e.g. http://homeassistant.local:8123)" >&2
        echo "  HASS_TOKEN = Long-lived access token" >&2
        exit 1
    fi
    # Strip trailing slash
    HASS_URL="${HASS_URL%/}"
}

# ── HTTP helpers ─────────────────────────────────────────────

ha_get() {
    local endpoint="$1"
    shift
    curl -sS --fail-with-body \
        -H "Authorization: Bearer ${HASS_TOKEN}" \
        -H "Content-Type: application/json" \
        "${HASS_URL}${endpoint}" "$@"
}

ha_post() {
    local endpoint="$1"
    local data="${2:-}"
    if [[ -n "$data" ]]; then
        curl -sS --fail-with-body \
            -H "Authorization: Bearer ${HASS_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${HASS_URL}${endpoint}"
    else
        curl -sS --fail-with-body \
            -H "Authorization: Bearer ${HASS_TOKEN}" \
            -H "Content-Type: application/json" \
            -X POST \
            "${HASS_URL}${endpoint}"
    fi
}

ha_delete() {
    local endpoint="$1"
    curl -sS --fail-with-body \
        -X DELETE \
        -H "Authorization: Bearer ${HASS_TOKEN}" \
        -H "Content-Type: application/json" \
        "${HASS_URL}${endpoint}"
}

# ── Commands ─────────────────────────────────────────────────

cmd_ping() {
    ha_get "/api/" | jq .
}

cmd_config() {
    ha_get "/api/config" | jq .
}

cmd_check_config() {
    ha_post "/api/config/core/check_config" | jq .
}

cmd_error_log() {
    ha_get "/api/error_log"
}

cmd_components() {
    ha_get "/api/components" | jq -r '.[]' | sort
}

# ── State commands ───────────────────────────────────────────

cmd_state() {
    local entity_id="${1:?Usage: $SCRIPT_NAME state <entity_id>}"
    ha_get "/api/states/${entity_id}" | jq .
}

cmd_states() {
    local domain="" search="" format="table" limit=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --domain|-d)  domain="$2"; shift 2 ;;
            --search|-s)  search="$2"; shift 2 ;;
            --json|-j)    format="json"; shift ;;
            --limit|-n)   limit="$2"; shift 2 ;;
            *)            # positional: treat as domain if no flag
                          if [[ -z "$domain" ]]; then domain="$1"; fi; shift ;;
        esac
    done

    local raw
    raw=$(ha_get "/api/states")

    # Apply filters with jq
    local jq_filter='.'
    if [[ -n "$domain" ]]; then
        jq_filter="${jq_filter} | map(select(.entity_id | startswith(\"${domain}.\")))"
    fi
    if [[ -n "$search" ]]; then
        local q
        q=$(echo "$search" | tr '[:upper:]' '[:lower:]')
        jq_filter="${jq_filter} | map(select(
            (.entity_id | ascii_downcase | contains(\"${q}\")) or
            (.attributes.friendly_name // \"\" | ascii_downcase | contains(\"${q}\"))
        ))"
    fi

    if [[ "$format" == "json" ]]; then
        echo "$raw" | jq "$jq_filter"
    else
        local table_filter="${jq_filter} | sort_by(.entity_id)"
        if [[ -n "$limit" ]]; then
            table_filter="${table_filter} | .[:${limit}]"
        fi
        table_filter="${table_filter} | .[] | [.entity_id, .state, (.attributes.friendly_name // \"-\"), (.attributes.unit_of_measurement // \"-\")] | @tsv"
        echo -e "ENTITY_ID\tSTATE\tFRIENDLY_NAME\tUNIT"
        echo "$raw" | jq -r "$table_filter" | column -t -s $'\t' 2>/dev/null || echo "$raw" | jq -r "$table_filter"
    fi
}

cmd_set_state() {
    local entity_id="${1:?Usage: $SCRIPT_NAME set-state <entity_id> <state> [attributes_json]}"
    local state="${2:?Usage: $SCRIPT_NAME set-state <entity_id> <state> [attributes_json]}"
    local attrs="${3:-}"

    local data
    if [[ -n "$attrs" ]]; then
        data=$(jq -n --arg s "$state" --argjson a "$attrs" '{state: $s, attributes: $a}')
    else
        data=$(jq -n --arg s "$state" '{state: $s}')
    fi
    ha_post "/api/states/${entity_id}" "$data" | jq .
}

cmd_delete_state() {
    local entity_id="${1:?Usage: $SCRIPT_NAME delete-state <entity_id>}"
    ha_delete "/api/states/${entity_id}"
}

# ── Service commands ─────────────────────────────────────────

cmd_services() {
    local domain="${1:-}"
    local raw
    raw=$(ha_get "/api/services")

    if [[ -n "$domain" ]]; then
        echo "$raw" | jq --arg d "$domain" '.[] | select(.domain == $d)'
    else
        echo "$raw" | jq -r '.[] | .domain' | sort
    fi
}

cmd_call() {
    local domain="${1:?Usage: $SCRIPT_NAME call <domain> <service> [--data '{...}'] [--response]}"
    local service="${2:?Usage: $SCRIPT_NAME call <domain> <service> [--data '{...}'] [--response]}"
    shift 2

    local data="" return_response=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --data|-d)     data="$2"; shift 2 ;;
            --response|-r) return_response="?return_response"; shift ;;
            *)             # treat positional as data JSON
                           if [[ -z "$data" ]]; then data="$1"; fi; shift ;;
        esac
    done

    local endpoint="/api/services/${domain}/${service}${return_response}"
    if [[ -n "$data" ]]; then
        ha_post "$endpoint" "$data" | jq .
    else
        ha_post "$endpoint" | jq .
    fi
}

# ── History ──────────────────────────────────────────────────

cmd_history() {
    local entity_id="" hours="24" start="" end="" minimal="1"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --entity|-e)  entity_id="$2"; shift 2 ;;
            --hours|-h)   hours="$2"; shift 2 ;;
            --start)      start="$2"; shift 2 ;;
            --end)        end="$2"; shift 2 ;;
            --full)       minimal=""; shift ;;
            *)            # positional: entity_id
                          if [[ -z "$entity_id" ]]; then entity_id="$1"; fi; shift ;;
        esac
    done

    if [[ -z "$entity_id" ]]; then
        echo "Usage: $SCRIPT_NAME history <entity_id> [--hours N] [--start ISO] [--end ISO] [--full]" >&2
        exit 1
    fi

    # Build start timestamp
    if [[ -z "$start" ]]; then
        if command -v gdate &>/dev/null; then
            start=$(gdate -u -d "-${hours} hours" +%Y-%m-%dT%H:%M:%S+00:00)
        else
            start=$(date -u -v-${hours}H +%Y-%m-%dT%H:%M:%S+00:00 2>/dev/null || date -u -d "-${hours} hours" +%Y-%m-%dT%H:%M:%S+00:00)
        fi
    fi

    local params="filter_entity_id=${entity_id}"
    [[ -n "$minimal" ]] && params="${params}&minimal_response&no_attributes"
    [[ -n "$end" ]] && params="${params}&end_time=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${end}'))")"

    local encoded_start
    encoded_start=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${start}'))")

    ha_get "/api/history/period/${encoded_start}?${params}" | jq .
}

# ── Logbook ──────────────────────────────────────────────────

cmd_logbook() {
    local entity_id="" hours="24" start=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --entity|-e)  entity_id="$2"; shift 2 ;;
            --hours|-h)   hours="$2"; shift 2 ;;
            --start)      start="$2"; shift 2 ;;
            *)            if [[ -z "$entity_id" ]]; then entity_id="$1"; fi; shift ;;
        esac
    done

    if [[ -z "$start" ]]; then
        if command -v gdate &>/dev/null; then
            start=$(gdate -u -d "-${hours} hours" +%Y-%m-%dT%H:%M:%S+00:00)
        else
            start=$(date -u -v-${hours}H +%Y-%m-%dT%H:%M:%S+00:00 2>/dev/null || date -u -d "-${hours} hours" +%Y-%m-%dT%H:%M:%S+00:00)
        fi
    fi

    local encoded_start
    encoded_start=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${start}'))")

    local params=""
    [[ -n "$entity_id" ]] && params="?entity=${entity_id}"

    ha_get "/api/logbook/${encoded_start}${params}" | jq .
}

# ── Template ─────────────────────────────────────────────────

cmd_template() {
    local tmpl="${1:?Usage: $SCRIPT_NAME template '<jinja2 template>'}"
    ha_post "/api/template" "$(jq -n --arg t "$tmpl" '{template: $t}')"
}

# ── Events ───────────────────────────────────────────────────

cmd_events() {
    ha_get "/api/events" | jq .
}

cmd_fire_event() {
    local event_type="${1:?Usage: $SCRIPT_NAME fire-event <event_type> [data_json]}"
    local data="${2:-}"
    ha_post "/api/events/${event_type}" "$data" | jq .
}

# ── Calendars ────────────────────────────────────────────────

cmd_calendars() {
    local entity_id="${1:-}"
    if [[ -z "$entity_id" ]]; then
        ha_get "/api/calendars" | jq .
    else
        local start end
        start=$(date -u +%Y-%m-%dT00:00:00.000Z)
        end=$(date -u -v+30d +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -d "+30 days" +%Y-%m-%dT00:00:00.000Z)
        ha_get "/api/calendars/${entity_id}?start=${start}&end=${end}" | jq .
    fi
}

# ── Convenience: entity discovery via templates ──────────────

cmd_areas() {
    cmd_template '{% for area in areas() %}{{ area }}|{{ area_name(area) }}
{% endfor %}'
}

cmd_devices() {
    local area="${1:-}"
    if [[ -n "$area" ]]; then
        cmd_template "{% for device_id in area_devices('${area}') %}{% set d = device_attr(device_id, 'name') %}{{ device_id }}|{{ d }}
{% endfor %}"
    else
        cmd_template '{% for state in states %}{% if state.attributes.device_class is defined %}{{ state.entity_id }}|{{ state.attributes.friendly_name }}|{{ state.attributes.device_class }}
{% endif %}{% endfor %}'
    fi
}

cmd_entities() {
    local domain="${1:-}" area="${2:-}"
    if [[ -n "$area" ]]; then
        cmd_template "{% for entity_id in area_entities('${area}') %}{% if '${domain}' == '' or entity_id.startswith('${domain}.') %}{% set s = states(entity_id) %}{{ entity_id }}|{{ s }}|{{ state_attr(entity_id, 'friendly_name') }}
{% endif %}{% endfor %}"
    elif [[ -n "$domain" ]]; then
        cmd_template "{% for state in states.${domain} %}{{ state.entity_id }}|{{ state.state }}|{{ state.attributes.friendly_name }}
{% endfor %}"
    else
        cmd_template '{% for state in states | sort(attribute="entity_id") %}{{ state.entity_id }}|{{ state.state }}|{{ state.attributes.friendly_name }}
{% endfor %}'
    fi
}

cmd_automations() {
    cmd_template '{% for auto in states.automation | sort(attribute="entity_id") %}{{ auto.entity_id }}|{{ auto.state }}|{{ auto.attributes.friendly_name }}|{{ auto.attributes.last_triggered }}
{% endfor %}'
}

cmd_scenes() {
    cmd_template '{% for scene in states.scene | sort(attribute="entity_id") %}{{ scene.entity_id }}|{{ scene.attributes.friendly_name }}
{% endfor %}'
}

cmd_scripts() {
    cmd_template '{% for s in states.script | sort(attribute="entity_id") %}{{ s.entity_id }}|{{ s.state }}|{{ s.attributes.friendly_name }}
{% endfor %}'
}

cmd_input_helpers() {
    cmd_template '{% for domain in ["input_boolean", "input_number", "input_select", "input_text", "input_datetime", "input_button", "timer", "counter"] %}{% for state in states[domain] | default([]) | sort(attribute="entity_id") %}{{ state.entity_id }}|{{ state.state }}|{{ state.attributes.friendly_name }}
{% endfor %}{% endfor %}'
}

# ── Convenience: domain-specific shortcuts ───────────────────

cmd_climate() {
    local entity_id="${1:-}"
    if [[ -z "$entity_id" ]]; then
        cmd_states --domain climate --json | jq '[.[] | {
            entity_id,
            state,
            current_temperature: .attributes.current_temperature,
            target_temperature: .attributes.temperature,
            hvac_modes: .attributes.hvac_modes,
            fan_mode: .attributes.fan_mode,
            fan_modes: .attributes.fan_modes,
            swing_mode: .attributes.swing_mode,
            friendly_name: .attributes.friendly_name
        }]'
    else
        ha_get "/api/states/${entity_id}" | jq '{
            entity_id,
            state,
            current_temperature: .attributes.current_temperature,
            target_temperature: .attributes.temperature,
            hvac_action: .attributes.hvac_action,
            hvac_modes: .attributes.hvac_modes,
            fan_mode: .attributes.fan_mode,
            fan_modes: .attributes.fan_modes,
            swing_mode: .attributes.swing_mode,
            preset_mode: .attributes.preset_mode,
            preset_modes: .attributes.preset_modes,
            min_temp: .attributes.min_temp,
            max_temp: .attributes.max_temp,
            friendly_name: .attributes.friendly_name
        }'
    fi
}

cmd_lights() {
    local entity_id="${1:-}"
    if [[ -z "$entity_id" ]]; then
        cmd_states --domain light --json | jq '[.[] | {
            entity_id,
            state,
            brightness: .attributes.brightness,
            color_mode: .attributes.color_mode,
            friendly_name: .attributes.friendly_name
        }]'
    else
        ha_get "/api/states/${entity_id}" | jq .
    fi
}

cmd_switches() {
    cmd_states --domain switch
}

cmd_sensors() {
    local search="${1:-}"
    if [[ -n "$search" ]]; then
        cmd_states --domain sensor --search "$search"
    else
        cmd_states --domain sensor
    fi
}

# ── Usage ────────────────────────────────────────────────────

usage() {
    cat << 'EOF'
Home Assistant REST API CLI

Usage: ha.sh <command> [options]

Core:
  ping                              Check API is running
  config                            Get HA configuration
  check-config                      Validate configuration.yaml
  error-log                         Get error log
  components                        List loaded components

States:
  state <entity_id>                 Get entity state (full JSON)
  states [domain] [--search q]      List states (table format)
    --domain|-d <domain>              Filter by domain (light, sensor, etc.)
    --search|-s <query>               Search entity_id or friendly_name
    --json|-j                         Output JSON instead of table
    --limit|-n <N>                    Limit results
  set-state <entity_id> <state> [attrs_json]   Set entity state
  delete-state <entity_id>          Delete entity state

Services:
  services [domain]                 List services (or details for domain)
  call <domain> <service> [opts]    Call a service
    --data|-d '{...}'                 Service data JSON
    --response|-r                     Request response data

History & Logbook:
  history <entity_id> [opts]        Get state history
    --hours|-h <N>                    Lookback hours (default: 24)
    --start <ISO timestamp>           Custom start time
    --end <ISO timestamp>             Custom end time
    --full                            Include all attributes
  logbook [entity_id] [opts]        Get logbook entries
    --hours|-h <N>                    Lookback hours (default: 24)

Templates:
  template '<jinja2>'               Render a Jinja2 template

Events:
  events                            List event listeners
  fire-event <type> [data_json]     Fire an event

Calendars:
  calendars [entity_id]             List calendars or events

Discovery (via templates):
  areas                             List all areas
  devices [area_id]                 List devices (optionally by area)
  entities [domain] [area_id]       List entities by domain/area
  automations                       List all automations
  scenes                            List all scenes
  scripts                           List all scripts
  input-helpers                     List input_*, timer, counter helpers

Domain shortcuts:
  climate [entity_id]               Climate entities with key attributes
  lights [entity_id]                Light entities with brightness/color
  switches                          Switch entities
  sensors [search]                  Sensor entities (with optional search)

Environment:
  HASS_URL    Home Assistant URL (e.g. http://homeassistant.local:8123)
  HASS_TOKEN  Long-lived access token

Examples:
  ha.sh state sensor.living_room_temperature
  ha.sh states --domain climate
  ha.sh states --search "bedroom"
  ha.sh call light turn_on --data '{"entity_id":"light.lounge","brightness":128}'
  ha.sh call climate set_temperature --data '{"entity_id":"climate.ac","temperature":23}'
  ha.sh history sensor.temperature --hours 6
  ha.sh template '{{ states("sensor.living_room_temperature") }}'
  ha.sh entities sensor
  ha.sh areas
EOF
}

# ── Main ─────────────────────────────────────────────────────

main() {
    local cmd="${1:-help}"
    shift || true

    if [[ "$cmd" == "help" || "$cmd" == "--help" || "$cmd" == "-h" ]]; then
        usage
        return 0
    fi

    check_env

    case "$cmd" in
        ping)           cmd_ping "$@" ;;
        config)         cmd_config "$@" ;;
        check-config)   cmd_check_config "$@" ;;
        error-log)      cmd_error_log "$@" ;;
        components)     cmd_components "$@" ;;
        state)          cmd_state "$@" ;;
        states)         cmd_states "$@" ;;
        set-state)      cmd_set_state "$@" ;;
        delete-state)   cmd_delete_state "$@" ;;
        services)       cmd_services "$@" ;;
        call)           cmd_call "$@" ;;
        history)        cmd_history "$@" ;;
        logbook)        cmd_logbook "$@" ;;
        template)       cmd_template "$@" ;;
        events)         cmd_events "$@" ;;
        fire-event)     cmd_fire_event "$@" ;;
        calendars)      cmd_calendars "$@" ;;
        areas)          cmd_areas "$@" ;;
        devices)        cmd_devices "$@" ;;
        entities)       cmd_entities "$@" ;;
        automations)    cmd_automations "$@" ;;
        scenes)         cmd_scenes "$@" ;;
        scripts)        cmd_scripts "$@" ;;
        input-helpers)  cmd_input_helpers "$@" ;;
        climate)        cmd_climate "$@" ;;
        lights)         cmd_lights "$@" ;;
        switches)       cmd_switches "$@" ;;
        sensors)        cmd_sensors "$@" ;;
        *)              echo "Unknown command: $cmd" >&2; usage >&2; exit 1 ;;
    esac
}

main "$@"
