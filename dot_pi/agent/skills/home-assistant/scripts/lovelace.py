#!/usr/bin/env python3
"""Lovelace dashboard helper — read and update dashboards via the HA websocket API.

Usage:
    python3 lovelace.py get <url_path>                          # Print dashboard JSON
    python3 lovelace.py get <url_path> <jq-style path>          # Print a subtree
    python3 lovelace.py update <url_path> '<python expression>' # Modify and save

The update expression receives `config` (the full dashboard dict) and must mutate it in place.

Environment variables:
    HASS_URL   — Home Assistant base URL (e.g. https://ha.example.com)
    HASS_TOKEN — Long-lived access token

Examples:
    # Dump view titles
    python3 lovelace.py get dashboard-mushroom 'views' | python3 -c "
        import sys,json; [print(f'[{i}] {v.get(\"title\",\"?\")}') for i,v in enumerate(json.load(sys.stdin))]"

    # Insert a card
    python3 lovelace.py update dashboard-mushroom \
      'config["views"][11]["cards"][0]["cards"].insert(3, {"type":"custom:bubble-card","card_type":"media-player","entity":"media_player.sonos_eliza_bedroom"})'

    # Change an entity reference
    python3 lovelace.py update dashboard-mushroom \
      'config["views"][0]["cards"][3]["entity"] = "switch.new_entity"'
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


async def connect():
    """Connect and authenticate to HA websocket, return (websocket, msg_id)."""
    hass_url = os.environ["HASS_URL"].replace("http://", "ws://").replace("https://", "wss://")
    token = os.environ["HASS_TOKEN"]
    uri = f"{hass_url}/api/websocket"

    ws = await websockets.connect(uri)
    msg = json.loads(await ws.recv())
    assert msg["type"] == "auth_required"

    await ws.send(json.dumps({"type": "auth", "access_token": token}))
    msg = json.loads(await ws.recv())
    if msg["type"] != "auth_ok":
        print(f"Auth failed: {msg}", file=sys.stderr)
        sys.exit(1)

    return ws, 1


async def get_config(ws, msg_id, url_path):
    """Fetch a dashboard config via websocket."""
    await ws.send(json.dumps({
        "id": msg_id,
        "type": "lovelace/config",
        "url_path": url_path,
    }))
    msg = json.loads(await ws.recv())
    if not msg.get("success"):
        print(f"Failed to get config: {msg}", file=sys.stderr)
        sys.exit(1)
    return msg["result"], msg_id + 1


async def save_config(ws, msg_id, url_path, config):
    """Save a dashboard config via websocket."""
    await ws.send(json.dumps({
        "id": msg_id,
        "type": "lovelace/config/save",
        "url_path": url_path,
        "config": config,
    }))
    msg = json.loads(await ws.recv())
    if not msg.get("success"):
        print(f"Save failed: {msg}", file=sys.stderr)
        sys.exit(1)
    return msg_id + 1


def resolve_path(obj, path_str):
    """Resolve a dot/bracket path like 'views[11].cards[0]' into the nested object."""
    import re
    parts = re.findall(r'[^.\[\]]+', path_str)
    for part in parts:
        if part.isdigit():
            obj = obj[int(part)]
        else:
            obj = obj[part]
    return obj


async def cmd_get(url_path, path=None):
    ws, msg_id = await connect()
    config, _ = await get_config(ws, msg_id, url_path)
    await ws.close()

    if path:
        config = resolve_path(config, path)

    print(json.dumps(config, indent=2))


async def cmd_update(url_path, expression):
    ws, msg_id = await connect()
    config, msg_id = await get_config(ws, msg_id, url_path)

    # Execute the user's expression with `config` in scope
    exec(expression, {"config": config, "json": json})

    msg_id = await save_config(ws, msg_id, url_path, config)
    await ws.close()
    print("✓ Dashboard saved")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    url_path = sys.argv[2]

    if command == "get":
        path = sys.argv[3] if len(sys.argv) > 3 else None
        asyncio.run(cmd_get(url_path, path))
    elif command == "update":
        if len(sys.argv) < 4:
            print("Error: update requires a Python expression", file=sys.stderr)
            sys.exit(1)
        expression = sys.argv[3]
        asyncio.run(cmd_update(url_path, expression))
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
