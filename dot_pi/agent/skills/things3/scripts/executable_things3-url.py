#!/usr/bin/env python3
"""Small Pi-friendly Things 3 helper using Things URL scheme.

This intentionally avoids storing tokens. It can create tasks/projects via
Things' unauthenticated add/json URLs and open Things views. Reads/updates are
not implemented here because robust reads require MCP/SQLite + macOS TCC access.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import urllib.parse
from typing import Any


def run_open(url: str, dry_run: bool) -> None:
    if dry_run:
        print(url)
        return
    subprocess.run(["open", "-g", url], check=True)
    print("Opened Things URL")


def compact_dict(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v not in (None, "", [], {})}


def things_add_url(params: dict[str, Any]) -> str:
    cleaned: dict[str, str] = {}
    for key, value in compact_dict(params).items():
        if isinstance(value, list):
            if key == "checklist-items":
                cleaned[key] = json.dumps(value, ensure_ascii=False)
            else:
                cleaned[key] = ",".join(value)
        else:
            cleaned[key] = str(value)
    return "things:///add?" + urllib.parse.urlencode(cleaned)


def things_json_url(items: list[dict[str, Any]]) -> str:
    payload = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
    return "things:///json?" + urllib.parse.urlencode({"data": payload})


def add_todo(args: argparse.Namespace) -> None:
    url = things_add_url({
        "title": args.title,
        "notes": args.notes,
        "when": args.when,
        "deadline": args.deadline,
        "tags": args.tag,
        "list": args.list,
        "heading": args.heading,
        "checklist-items": args.checklist,
    })
    run_open(url, args.dry_run)


def add_project(args: argparse.Namespace) -> None:
    project: dict[str, Any] = compact_dict({
        "type": "project",
        "attributes": compact_dict({
            "title": args.title,
            "notes": args.notes,
            "when": args.when,
            "deadline": args.deadline,
            "area": args.area,
            "tags": args.tag,
        }),
    })
    todos = []
    for title in args.todo or []:
        todos.append({"type": "to-do", "attributes": {"title": title}})
    if todos:
        project["attributes"]["items"] = todos
    run_open(things_json_url([project]), args.dry_run)


def import_json(args: argparse.Namespace) -> None:
    if args.file == "-":
        raw = sys.stdin.read()
    else:
        raw = open(args.file, encoding="utf-8").read()
    data = json.loads(raw)
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        raise SystemExit("Things JSON import payload must be an object or list")
    run_open(things_json_url(data), args.dry_run)


def show(args: argparse.Namespace) -> None:
    target = args.target
    if target in {"inbox", "today", "upcoming", "anytime", "someday", "logbook"}:
        url = f"things:///show?id={target}"
    else:
        url = "things:///show?" + urllib.parse.urlencode({"query": target})
    run_open(url, args.dry_run)


def doctor(_: argparse.Namespace) -> None:
    print("Things 3 helper doctor")
    try:
        app_id = subprocess.check_output(["osascript", "-e", 'id of app "Things3"'], text=True, timeout=10).strip()
        print(f"✓ Things app bundle id: {app_id}")
    except Exception as e:
        print(f"✗ Things app not reachable via AppleScript lookup: {e}")
        raise SystemExit(1)
    print(f"{'✓' if shutil.which('open') else '✗'} open command: {shutil.which('open') or 'missing'}")
    print("✓ create/show helpers use things:/// URLs and do not require storing a Things token")
    print("Note: first real use may prompt macOS/Things for permission or require Things URLs enabled in Things → Settings → General.")


def main() -> None:
    p = argparse.ArgumentParser(description="Pi helper for Things 3 URL-scheme operations")
    sub = p.add_subparsers(dest="cmd", required=True)

    common_parent = argparse.ArgumentParser(add_help=False)
    common_parent.add_argument("--dry-run", action="store_true", help="print URL instead of opening Things")

    t = sub.add_parser("add-todo", parents=[common_parent], help="create a Things to-do")
    t.add_argument("title")
    t.add_argument("--notes")
    t.add_argument("--when", dest="when", help="today, tomorrow, evening, anytime, someday, or YYYY-MM-DD")
    t.add_argument("--deadline", help="YYYY-MM-DD")
    t.add_argument("--tag", action="append", default=[])
    t.add_argument("--list", help="project or area title")
    t.add_argument("--heading", help="project heading title")
    t.add_argument("--checklist", action="append", default=[], help="repeat for each checklist item")
    t.set_defaults(func=add_todo)

    pr = sub.add_parser("add-project", parents=[common_parent], help="create a Things project")
    pr.add_argument("title")
    pr.add_argument("--notes")
    pr.add_argument("--when", dest="when")
    pr.add_argument("--deadline")
    pr.add_argument("--area")
    pr.add_argument("--tag", action="append", default=[])
    pr.add_argument("--todo", action="append", default=[], help="initial to-do title; repeatable")
    pr.set_defaults(func=add_project)

    ij = sub.add_parser("import-json", parents=[common_parent], help="import Things JSON payload from file or stdin")
    ij.add_argument("file", help="JSON file, or - for stdin")
    ij.set_defaults(func=import_json)

    s = sub.add_parser("show", parents=[common_parent], help="open a Things list or search")
    s.add_argument("target", help="inbox/today/upcoming/anytime/someday/logbook or search text")
    s.set_defaults(func=show)

    d = sub.add_parser("doctor", help="check local prerequisites")
    d.set_defaults(func=doctor)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
