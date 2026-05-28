#!/usr/bin/env python3
"""
Telegram CLI wrapper using Telethon.
JSON output on stdout, warnings/errors on stderr.
Session and credentials stored in ~/.config/telegram-cli/
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CONFIG_DIR = Path.home() / ".config" / "telegram-cli"
SESSION_FILE = CONFIG_DIR / "session"
CRED_FILE = CONFIG_DIR / "credentials"

def load_credentials():
    """Load api_id and api_hash from env or credentials file."""
    api_id = os.environ.get("TG_API_ID")
    api_hash = os.environ.get("TG_API_HASH")
    if api_id and api_hash:
        return int(api_id), api_hash

    if CRED_FILE.exists():
        data = json.loads(CRED_FILE.read_text())
        return int(data["api_id"]), data["api_hash"]

    return None, None


def save_credentials(api_id: int, api_hash: str):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CRED_FILE.write_text(json.dumps({"api_id": api_id, "api_hash": api_hash}))
    CRED_FILE.chmod(0o600)


# ---------------------------------------------------------------------------
# Telethon client
# ---------------------------------------------------------------------------

def get_client():
    from telethon import TelegramClient
    api_id, api_hash = load_credentials()
    if not api_id or not api_hash:
        print(json.dumps({"ok": False, "error": "No credentials. Run: tg.py login"}), flush=True)
        sys.exit(1)
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return TelegramClient(str(SESSION_FILE), api_id, api_hash)


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def serialize_message(msg):
    """Convert a Telethon Message to a JSON-friendly dict."""
    from telethon.tl.types import (
        MessageMediaPhoto, MessageMediaDocument, MessageMediaWebPage,
        PeerUser, PeerChat, PeerChannel,
        MessageActionPinMessage, MessageActionChatAddUser,
        MessageActionChatDeleteUser, MessageActionChatJoinedByLink,
    )

    d = {
        "id": msg.id,
        "date": msg.date.isoformat() if msg.date else None,
        "text": msg.text or "",
    }

    # Sender
    if msg.sender:
        sender = {}
        if hasattr(msg.sender, "first_name"):
            parts = [msg.sender.first_name or ""]
            if msg.sender.last_name:
                parts.append(msg.sender.last_name)
            sender["name"] = " ".join(parts).strip()
            sender["id"] = msg.sender.id
            if msg.sender.username:
                sender["username"] = msg.sender.username
        elif hasattr(msg.sender, "title"):
            sender["name"] = msg.sender.title
            sender["id"] = msg.sender.id
        d["sender"] = sender

    # Reply
    if msg.reply_to and hasattr(msg.reply_to, "reply_to_msg_id"):
        d["reply_to"] = msg.reply_to.reply_to_msg_id

    # Media
    if msg.media:
        if isinstance(msg.media, MessageMediaPhoto):
            d["media"] = {"type": "photo"}
        elif isinstance(msg.media, MessageMediaDocument):
            doc = msg.media.document
            mime = getattr(doc, "mime_type", None)
            d["media"] = {"type": "document", "mime": mime}
            # Check for voice/video/sticker
            if doc and doc.attributes:
                for attr in doc.attributes:
                    cls = type(attr).__name__
                    if cls == "DocumentAttributeAudio":
                        d["media"]["type"] = "voice" if attr.voice else "audio"
                        d["media"]["duration"] = attr.duration
                    elif cls == "DocumentAttributeVideo":
                        d["media"]["type"] = "video_note" if attr.round_message else "video"
                        d["media"]["duration"] = attr.duration
                    elif cls == "DocumentAttributeSticker":
                        d["media"]["type"] = "sticker"
                        d["media"]["emoji"] = attr.alt
                    elif cls == "DocumentAttributeFilename":
                        d["media"]["filename"] = attr.file_name
        elif isinstance(msg.media, MessageMediaWebPage):
            d["media"] = {"type": "webpage"}
        else:
            d["media"] = {"type": type(msg.media).__name__}

    # Forwarded
    if msg.forward:
        fwd = {}
        if msg.forward.sender:
            fwd["from"] = getattr(msg.forward.sender, "first_name", None) or getattr(msg.forward.sender, "title", None)
        if msg.forward.date:
            fwd["date"] = msg.forward.date.isoformat()
        d["forward"] = fwd

    # Service actions
    if msg.action:
        if isinstance(msg.action, MessageActionPinMessage):
            d["action"] = "pin_message"
        elif isinstance(msg.action, MessageActionChatAddUser):
            d["action"] = "add_user"
        elif isinstance(msg.action, MessageActionChatDeleteUser):
            d["action"] = "remove_user"
        elif isinstance(msg.action, MessageActionChatJoinedByLink):
            d["action"] = "joined_by_link"
        else:
            d["action"] = type(msg.action).__name__

    return d


def serialize_dialog(dialog):
    """Convert a Telethon Dialog to a JSON-friendly dict."""
    d = {
        "id": dialog.id,
        "name": dialog.name,
        "unread_count": dialog.unread_count,
    }

    if dialog.is_user:
        d["type"] = "user"
        if dialog.entity.username:
            d["username"] = dialog.entity.username
        if dialog.entity.bot:
            d["type"] = "bot"
    elif dialog.is_group:
        d["type"] = "group"
    elif dialog.is_channel:
        d["type"] = "channel"

    if dialog.message:
        d["last_message"] = {
            "id": dialog.message.id,
            "date": dialog.message.date.isoformat() if dialog.message.date else None,
            "text": (dialog.message.text or "")[:200],
        }

    return d


def serialize_entity(entity):
    """Convert a Telethon entity to a JSON-friendly dict."""
    d = {"id": entity.id}

    if hasattr(entity, "first_name"):
        parts = [entity.first_name or ""]
        if entity.last_name:
            parts.append(entity.last_name)
        d["name"] = " ".join(parts).strip()
        d["type"] = "bot" if entity.bot else "user"
        if entity.username:
            d["username"] = entity.username
        if entity.phone:
            d["phone"] = entity.phone
    elif hasattr(entity, "title"):
        d["name"] = entity.title
        if hasattr(entity, "megagroup") and entity.megagroup:
            d["type"] = "group"
        elif hasattr(entity, "broadcast") and entity.broadcast:
            d["type"] = "channel"
        else:
            d["type"] = "group"
        if hasattr(entity, "username") and entity.username:
            d["username"] = entity.username
        if hasattr(entity, "participants_count") and entity.participants_count:
            d["members"] = entity.participants_count

    return d


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def success(data, has_more=False, next_offset=None):
    result = {"ok": True, "data": data}
    if has_more:
        result["hasMore"] = True
    if next_offset is not None:
        result["nextOffset"] = next_offset
    print(json.dumps(result, ensure_ascii=False, default=str), flush=True)


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}), flush=True)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

async def cmd_login(args):
    """Interactive login flow."""
    api_id, api_hash = load_credentials()

    if not api_id or not api_hash:
        print("Get your API credentials from https://my.telegram.org/apps", file=sys.stderr)
        try:
            api_id = int(input("api_id: "))
            api_hash = input("api_hash: ").strip()
        except (ValueError, EOFError):
            fail("Invalid credentials input")
        save_credentials(api_id, api_hash)
        print("Credentials saved.", file=sys.stderr)

    from telethon import TelegramClient
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    client = TelegramClient(str(SESSION_FILE), api_id, api_hash)
    await client.start()
    me = await client.get_me()
    await client.disconnect()
    success(serialize_entity(me))


async def cmd_me(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")
    me = await client.get_me()
    await client.disconnect()
    success(serialize_entity(me))


async def cmd_chats_list(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    from telethon.tl.types import User, Channel, Chat

    dialogs = []
    async for d in client.iter_dialogs(limit=args.limit, archived=args.archived):
        if args.type:
            if args.type == "user" and not (d.is_user and not d.entity.bot):
                continue
            elif args.type == "bot" and not (d.is_user and d.entity.bot):
                continue
            elif args.type == "group" and not d.is_group:
                continue
            elif args.type == "channel" and not (d.is_channel and not getattr(d.entity, 'megagroup', False)):
                continue
        if args.unread and d.unread_count == 0:
            continue
        dialogs.append(serialize_dialog(d))

    await client.disconnect()
    success(dialogs)


async def cmd_chats_search(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    # Search across dialogs
    results = []

    # Search in dialog list
    async for d in client.iter_dialogs():
        if args.query.lower() in d.name.lower():
            results.append(serialize_dialog(d))
            if len(results) >= args.limit:
                break

    await client.disconnect()
    success(results)


async def cmd_msg_list(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    try:
        entity = await client.get_entity(args.chat)
    except Exception as e:
        await client.disconnect()
        fail(f"Chat not found: {e}")

    kwargs = {"limit": args.limit}
    if args.offset_id:
        kwargs["offset_id"] = args.offset_id
    if args.min_id:
        kwargs["min_id"] = args.min_id

    messages = []
    async for msg in client.iter_messages(entity, **kwargs):
        if args.since and msg.date and msg.date.timestamp() < args.since:
            break
        if args.query and args.query.lower() not in (msg.text or "").lower():
            continue
        if args.from_user:
            if not msg.sender:
                continue
            sender_match = False
            if hasattr(msg.sender, 'username') and msg.sender.username:
                sender_match = msg.sender.username.lower() == args.from_user.lower().lstrip('@')
            if hasattr(msg.sender, 'first_name') and msg.sender.first_name:
                sender_match = sender_match or args.from_user.lower() in msg.sender.first_name.lower()
            if not sender_match:
                continue
        messages.append(serialize_message(msg))

    await client.disconnect()

    has_more = len(messages) == args.limit
    next_offset = messages[-1]["id"] if has_more and messages else None
    success(messages, has_more=has_more, next_offset=next_offset)


async def cmd_msg_search(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    kwargs = {"limit": args.limit}

    entity = None
    if args.chat:
        try:
            entity = await client.get_entity(args.chat)
        except Exception as e:
            await client.disconnect()
            fail(f"Chat not found: {e}")

    messages = []
    async for msg in client.iter_messages(entity, search=args.query, **kwargs):
        if args.since and msg.date and msg.date.timestamp() < args.since:
            break
        if args.until and msg.date and msg.date.timestamp() > args.until:
            continue
        d = serialize_message(msg)
        # Add chat info for cross-chat search
        if not args.chat and msg.chat:
            d["chat"] = {
                "id": msg.chat_id,
                "name": getattr(msg.chat, "title", None) or getattr(msg.chat, "first_name", None) or str(msg.chat_id),
            }
        if not args.full:
            d["text"] = (d["text"] or "")[:500]
        messages.append(d)

    await client.disconnect()

    has_more = len(messages) == args.limit
    next_offset = messages[-1]["id"] if has_more and messages else None
    success(messages, has_more=has_more, next_offset=next_offset)


async def cmd_msg_get(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    try:
        entity = await client.get_entity(args.chat)
    except Exception as e:
        await client.disconnect()
        fail(f"Chat not found: {e}")

    msgs = await client.get_messages(entity, ids=args.msg_id)
    msg = msgs if not isinstance(msgs, list) else (msgs[0] if msgs else None)
    await client.disconnect()

    if not msg:
        fail(f"Message {args.msg_id} not found")

    success(serialize_message(msg))


async def cmd_send(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    try:
        entity = await client.get_entity(args.chat)
    except Exception as e:
        await client.disconnect()
        fail(f"Chat not found: {e}")

    text = args.text
    if args.stdin:
        text = sys.stdin.read().rstrip("\n")

    if not text:
        await client.disconnect()
        fail("No message text provided")

    kwargs = {}
    if args.reply_to:
        kwargs["reply_to"] = args.reply_to
    if args.silent:
        kwargs["silent"] = True

    # Parse mode
    if args.html:
        kwargs["parse_mode"] = "html"
    elif args.md:
        kwargs["parse_mode"] = "md"

    msg = await client.send_message(entity, text, **kwargs)
    await client.disconnect()
    success(serialize_message(msg))


async def cmd_info(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    try:
        entity = await client.get_entity(args.entity)
    except Exception as e:
        await client.disconnect()
        fail(f"Entity not found: {e}")

    result = serialize_entity(entity)

    # Get full info if available
    try:
        from telethon.tl.functions.users import GetFullUserRequest
        from telethon.tl.functions.channels import GetFullChannelRequest
        from telethon.tl.types import User, Channel

        if isinstance(entity, User):
            full = await client(GetFullUserRequest(entity))
            if full.full_user.about:
                result["bio"] = full.full_user.about
        elif isinstance(entity, Channel):
            full = await client(GetFullChannelRequest(entity))
            if full.full_chat.about:
                result["description"] = full.full_chat.about
            if full.full_chat.participants_count:
                result["members"] = full.full_chat.participants_count
    except Exception:
        pass

    await client.disconnect()
    success(result)


async def cmd_download(args):
    client = get_client()
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        fail("Not logged in. Run: tg.py login")

    try:
        entity = await client.get_entity(args.chat)
    except Exception as e:
        await client.disconnect()
        fail(f"Chat not found: {e}")

    msgs = await client.get_messages(entity, ids=args.msg_id)
    msg = msgs if not isinstance(msgs, list) else (msgs[0] if msgs else None)

    if not msg or not msg.media:
        await client.disconnect()
        fail("Message has no downloadable media")

    output = args.output or "."
    path = await client.download_media(msg, file=output)
    await client.disconnect()
    success({"path": str(path)})


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_entity(value):
    """Parse chat/entity argument — handle numeric IDs, usernames, etc."""
    try:
        return int(value)
    except ValueError:
        return value


def build_parser():
    parser = argparse.ArgumentParser(prog="tg", description="Telegram CLI (Telethon)")
    sub = parser.add_subparsers(dest="command")

    # login
    sub.add_parser("login", help="Log in to Telegram (interactive)")

    # me
    sub.add_parser("me", help="Current user info")

    # info
    p = sub.add_parser("info", help="Get detailed info about a user/group/channel")
    p.add_argument("entity", type=parse_entity, help="ID, @username, phone, or t.me link")

    # chats list
    chats = sub.add_parser("chats", help="Chat commands")
    chats_sub = chats.add_subparsers(dest="chats_command")
    p = chats_sub.add_parser("list", help="List conversations")
    p.add_argument("--limit", type=int, default=40)
    p.add_argument("--type", choices=["user", "bot", "group", "channel"])
    p.add_argument("--unread", action="store_true")
    p.add_argument("--archived", action="store_true")

    p = chats_sub.add_parser("search", help="Search chats by name")
    p.add_argument("query")
    p.add_argument("--limit", type=int, default=20)

    # msg list / get / search
    msg = sub.add_parser("msg", help="Message commands")
    msg_sub = msg.add_subparsers(dest="msg_command")

    p = msg_sub.add_parser("list", help="Message history")
    p.add_argument("chat", type=parse_entity)
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--offset-id", type=int, dest="offset_id")
    p.add_argument("--min-id", type=int, dest="min_id")
    p.add_argument("--since", type=float, help="Unix timestamp")
    p.add_argument("--query", help="Filter text")
    p.add_argument("--from", dest="from_user", help="Filter by sender")

    p = msg_sub.add_parser("get", help="Get single message")
    p.add_argument("chat", type=parse_entity)
    p.add_argument("msg_id", type=int)

    p = msg_sub.add_parser("search", help="Search messages")
    p.add_argument("query")
    p.add_argument("--chat", type=parse_entity)
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--since", type=float)
    p.add_argument("--until", type=float)
    p.add_argument("--full", action="store_true")

    # send
    p = sub.add_parser("send", help="Send a message")
    p.add_argument("chat", type=parse_entity)
    p.add_argument("text", nargs="?", default=None)
    p.add_argument("--reply-to", type=int, dest="reply_to")
    p.add_argument("--html", action="store_true")
    p.add_argument("--md", action="store_true")
    p.add_argument("--silent", action="store_true")
    p.add_argument("--stdin", action="store_true")

    # download
    p = sub.add_parser("download", help="Download media from a message")
    p.add_argument("chat", type=parse_entity)
    p.add_argument("msg_id", type=int)
    p.add_argument("--output", "-o")

    return parser


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        if args.command == "login":
            await cmd_login(args)
        elif args.command == "me":
            await cmd_me(args)
        elif args.command == "info":
            await cmd_info(args)
        elif args.command == "chats":
            if args.chats_command == "list":
                await cmd_chats_list(args)
            elif args.chats_command == "search":
                await cmd_chats_search(args)
            else:
                fail("Unknown chats subcommand. Use: list, search")
        elif args.command == "msg":
            if args.msg_command == "list":
                await cmd_msg_list(args)
            elif args.msg_command == "get":
                await cmd_msg_get(args)
            elif args.msg_command == "search":
                await cmd_msg_search(args)
            else:
                fail("Unknown msg subcommand. Use: list, get, search")
        elif args.command == "send":
            await cmd_send(args)
        elif args.command == "download":
            await cmd_download(args)
        else:
            fail(f"Unknown command: {args.command}")
    except SystemExit:
        raise
    except Exception as e:
        fail(str(e))


if __name__ == "__main__":
    asyncio.run(main())
