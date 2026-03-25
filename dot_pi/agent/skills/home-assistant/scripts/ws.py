#!/usr/bin/env python3
"""Home Assistant websocket API helper — send arbitrary websocket commands.

Usage:
    python3 ws.py <json_message>
    python3 ws.py '{"type": "config/entity_registry/update", "entity_id": "scene.master_bedroom_4_chill", "name": "Master Bedroom Lights Chill"}'

The script auto-assigns the message `id` field — do not include it.
Prints the full JSON response to stdout.

Environment variables:
    HASS_URL   — Home Assistant base URL (e.g. https://ha.example.com)
    HASS_TOKEN — Long-lived access token

Common message types:

  Entity Registry:
    Get:    {"type": "config/entity_registry/get", "entity_id": "light.kitchen"}
    List:   {"type": "config/entity_registry/list"}
    Update: {"type": "config/entity_registry/update", "entity_id": "...", "name": "New Name"}
            Optional fields: name, icon, area_id, disabled_by, hidden_by, options

  Device Registry:
    List:   {"type": "config/device_registry/list"}
    Update: {"type": "config/device_registry/update", "device_id": "...", "name_by_user": "My Device"}

  Area Registry:
    List:   {"type": "config/area_registry/list"}
    Create: {"type": "config/area_registry/create", "name": "My Room"}

  Label Registry:
    List:   {"type": "config/label_registry/list"}
    Create: {"type": "config/label_registry/create", "name": "Climate", "icon": "mdi:thermostat", "color": "cyan"}

  Automation / Script / Scene:
    Reload: {"type": "call_service", "domain": "automation", "service": "reload"}

  Search related:
    {"type": "search/related", "item_type": "entity", "item_id": "light.kitchen"}
"""

import asyncio
import json
import os
import sys

try:
    import websockets
except ImportError:
    print("Error: websockets package required. Install with: pip install websockets", file=sys.stderr)
    sys.exit(1)


async def send_message(message: dict) -> dict:
    """Connect, authenticate, send one message, return the response."""
    hass_url = os.environ["HASS_URL"].replace("http://", "ws://").replace("https://", "wss://")
    token = os.environ["HASS_TOKEN"]

    ws = await websockets.connect(f"{hass_url}/api/websocket")

    # Auth handshake
    msg = json.loads(await ws.recv())
    assert msg["type"] == "auth_required"
    await ws.send(json.dumps({"type": "auth", "access_token": token}))
    msg = json.loads(await ws.recv())
    if msg["type"] != "auth_ok":
        print(f"Auth failed: {msg}", file=sys.stderr)
        sys.exit(1)

    # Send the command
    message["id"] = 1
    await ws.send(json.dumps(message))
    response = json.loads(await ws.recv())
    await ws.close()

    return response


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print(__doc__)
        sys.exit(0)

    try:
        message = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)

    response = asyncio.run(send_message(message))

    if response.get("success"):
        if response.get("result") is not None:
            print(json.dumps(response["result"], indent=2))
        else:
            print("✓ Success")
    else:
        print(json.dumps(response, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
