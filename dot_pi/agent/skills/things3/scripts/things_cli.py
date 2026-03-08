#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from typing import Callable, Iterable, Sequence, TypeVar

T = TypeVar("T")

_SEPARATOR = "\n\n---\n\n"


def _import_things():
    try:
        import things  # type: ignore
    except ImportError as exc:
        print(
            "Missing dependency 'things-py'. Run: bash .codex/skills/things3-manager/scripts/things --help",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc
    return things


def _split_csv(values: Iterable[str] | None) -> list[str] | None:
    if not values:
        return None
    items: list[str] = []
    for value in values:
        for part in str(value).split(","):
            part = part.strip()
            if part:
                items.append(part)
    return items or None


def _print_formatted(items: Sequence[T] | None, formatter: Callable[[T], str], empty_message: str) -> None:
    if not items:
        print(empty_message)
        return
    formatted = [formatter(item) for item in items]
    print(_SEPARATOR.join(formatted))


def cmd_inbox(_: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    _print_formatted(things.inbox(include_items=True), format_todo, "No items found")


def cmd_today(_: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    _print_formatted(things.today(include_items=True), format_todo, "No items found")


def cmd_upcoming(_: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    _print_formatted(things.upcoming(include_items=True), format_todo, "No items found")


def cmd_anytime(_: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    _print_formatted(things.anytime(include_items=True), format_todo, "No items found")


def cmd_someday(_: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    _print_formatted(things.someday(include_items=True), format_todo, "No items found")


def cmd_trash(_: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    _print_formatted(things.trash(include_items=True), format_todo, "No items found")


def cmd_logbook(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    todos = things.last(args.period, status="completed", include_items=True)
    if todos and len(todos) > args.limit:
        todos = todos[: args.limit]
    _print_formatted(todos, format_todo, "No items found")


def cmd_recent(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    todos = things.last(args.period, include_items=True)
    _print_formatted(todos, format_todo, f"No items found in the last {args.period}")


def cmd_todos(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    if args.project_uuid:
        project = things.get(args.project_uuid)
        if not project or project.get("type") != "project":
            print(f"Error: Invalid project UUID '{args.project_uuid}'", file=sys.stderr)
            raise SystemExit(2)

    params = {}
    if args.project_uuid:
        params["project"] = args.project_uuid
    if args.area_uuid:
        params["area"] = args.area_uuid
    if args.tag:
        params["tag"] = args.tag
    if args.status:
        params["status"] = args.status

    todos = things.todos(start=None, include_items=args.include_items, **params)
    _print_formatted(todos, format_todo, "No todos found")


def cmd_projects(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_project

    projects = things.projects()
    if not projects:
        print("No projects found")
        return
    formatted = [format_project(project, include_items=args.include_items) for project in projects]
    print(_SEPARATOR.join(formatted))


def cmd_areas(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_area

    areas = things.areas()
    if not areas:
        print("No areas found")
        return
    formatted = [format_area(area, include_items=args.include_items) for area in areas]
    print(_SEPARATOR.join(formatted))


def cmd_tags(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_tag

    tags = things.tags()
    if not tags:
        print("No tags found")
        return
    formatted = [format_tag(tag, include_items=args.include_items) for tag in tags]
    print(_SEPARATOR.join(formatted))


def cmd_tagged_items(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    todos = things.todos(tag=args.tag, include_items=True)
    _print_formatted(todos, format_todo, f"No items found with tag '{args.tag}'")


def cmd_headings(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_heading

    if args.project_uuid:
        project = things.get(args.project_uuid)
        if not project or project.get("type") != "project":
            print(f"Error: Invalid project UUID '{args.project_uuid}'", file=sys.stderr)
            raise SystemExit(2)
        headings = things.tasks(type="heading", project=args.project_uuid)
    else:
        headings = things.tasks(type="heading")

    _print_formatted(headings, format_heading, "No headings found")


def cmd_search(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    todos = things.search(args.query, include_items=True)
    _print_formatted(todos, format_todo, f"No todos found matching '{args.query}'")


def cmd_search_advanced(args: argparse.Namespace) -> None:
    things = _import_things()
    from formatters import format_todo

    search_params = {}
    if args.status:
        search_params["status"] = args.status
    if args.start_date:
        search_params["start_date"] = args.start_date
    if args.deadline:
        search_params["deadline"] = args.deadline
    if args.tag:
        search_params["tag"] = args.tag
    if args.area_uuid:
        search_params["area"] = args.area_uuid
    if args.type:
        search_params["type"] = args.type

    try:
        todos = things.todos(include_items=True, **search_params)
    except TypeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc

    _print_formatted(todos, format_todo, "No matching todos found")


def cmd_add_todo(args: argparse.Namespace) -> None:
    _import_things()  # token handling lives in url_scheme; validate import early
    import url_scheme

    tags = _split_csv(args.tag)
    checklist = args.checklist or None

    url = url_scheme.add_todo(
        title=args.title,
        notes=args.notes,
        when=args.when,
        deadline=args.deadline,
        tags=tags,
        checklist_items=checklist,
        list_id=args.list_id,
        list_title=args.list_title,
        heading=args.heading,
        heading_id=args.heading_id,
    )

    if args.dry_run:
        print(url)
        return

    url_scheme.execute_url(url)
    print(f"Created new todo: {args.title}")


def cmd_add_project(args: argparse.Namespace) -> None:
    _import_things()
    import url_scheme

    tags = _split_csv(args.tag)
    todos = args.todo or None

    url = url_scheme.add_project(
        title=args.title,
        notes=args.notes,
        when=args.when,
        deadline=args.deadline,
        tags=tags,
        area_id=args.area_id,
        area_title=args.area_title,
        todos=todos,
    )

    if args.dry_run:
        print(url)
        return

    url_scheme.execute_url(url)
    print(f"Created new project: {args.title}")


def cmd_update_todo(args: argparse.Namespace) -> None:
    _import_things()
    import url_scheme

    tags = _split_csv(args.tag)

    url = url_scheme.update_todo(
        id=args.id,
        title=args.title,
        notes=args.notes,
        when=args.when,
        deadline=args.deadline,
        tags=tags,
        completed=args.completed,
        canceled=args.canceled,
        list=args.list,
        list_id=args.list_id,
        heading=args.heading,
        heading_id=args.heading_id,
    )

    if args.dry_run:
        print(url)
        return

    url_scheme.execute_url(url)
    print(f"Updated todo with ID: {args.id}")


def cmd_update_project(args: argparse.Namespace) -> None:
    _import_things()
    import url_scheme

    tags = _split_csv(args.tag)

    url = url_scheme.update_project(
        id=args.id,
        title=args.title,
        notes=args.notes,
        when=args.when,
        deadline=args.deadline,
        tags=tags,
        completed=args.completed,
        canceled=args.canceled,
    )

    if args.dry_run:
        print(url)
        return

    url_scheme.execute_url(url)
    print(f"Updated project with ID: {args.id}")


def cmd_show(args: argparse.Namespace) -> None:
    _import_things()
    import url_scheme

    filter_tags = _split_csv(args.filter_tag)

    url = url_scheme.show(id=args.id, query=args.query, filter_tags=filter_tags)
    if args.dry_run:
        print(url)
        return

    url_scheme.execute_url(url)
    print(f"Showing item: {args.id}")


def cmd_search_items(args: argparse.Namespace) -> None:
    _import_things()
    import url_scheme

    url = url_scheme.search(args.query)
    if args.dry_run:
        print(url)
        return

    url_scheme.execute_url(url)
    print(f"Searching for '{args.query}'")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="things", description="Things 3 task manager CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    # Lists
    sub.add_parser("inbox", help="List Inbox items").set_defaults(func=cmd_inbox)
    sub.add_parser("today", help="List Today items").set_defaults(func=cmd_today)
    sub.add_parser("upcoming", help="List Upcoming items").set_defaults(func=cmd_upcoming)
    sub.add_parser("anytime", help="List Anytime items").set_defaults(func=cmd_anytime)
    sub.add_parser("someday", help="List Someday items").set_defaults(func=cmd_someday)
    sub.add_parser("trash", help="List trashed items").set_defaults(func=cmd_trash)

    p = sub.add_parser("logbook", help="List completed items from Logbook")
    p.add_argument("--period", default="7d", help="Lookback period, e.g. 3d, 1w, 2m, 1y (default: 7d)")
    p.add_argument("--limit", type=int, default=50, help="Max entries to return (default: 50)")
    p.set_defaults(func=cmd_logbook)

    p = sub.add_parser("recent", help="List recently created/modified items")
    p.add_argument("period", help="Lookback period, e.g. 3d, 1w, 2m, 1y")
    p.set_defaults(func=cmd_recent)

    # Browsing
    p = sub.add_parser("todos", help="List todos with optional filters")
    p.add_argument("--project-uuid", help="Filter by project UUID")
    p.add_argument("--area-uuid", help="Filter by area UUID")
    p.add_argument("--tag", help="Filter by tag title")
    p.add_argument("--status", help="Filter by status (incomplete, completed, canceled)")
    p.add_argument("--include-items", action=argparse.BooleanOptionalAction, default=True, help="Include checklist items")
    p.set_defaults(func=cmd_todos)

    p = sub.add_parser("projects", help="List projects")
    p.add_argument("--include-items", action=argparse.BooleanOptionalAction, default=False, help="Include todos within projects")
    p.set_defaults(func=cmd_projects)

    p = sub.add_parser("areas", help="List areas")
    p.add_argument("--include-items", action=argparse.BooleanOptionalAction, default=False, help="Include projects/todos within areas")
    p.set_defaults(func=cmd_areas)

    p = sub.add_parser("tags", help="List tags")
    p.add_argument("--include-items", action=argparse.BooleanOptionalAction, default=False, help="Include items for each tag")
    p.set_defaults(func=cmd_tags)

    p = sub.add_parser("tagged-items", help="List items with a specific tag")
    p.add_argument("tag", help="Tag title to filter by")
    p.set_defaults(func=cmd_tagged_items)

    p = sub.add_parser("headings", help="List headings (optionally within a project)")
    p.add_argument("--project-uuid", help="Project UUID to filter headings by")
    p.set_defaults(func=cmd_headings)

    # Search
    p = sub.add_parser("search", help="Search todos by title/notes")
    p.add_argument("query", help="Search term")
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("search-advanced", help="Advanced search with multiple filters")
    p.add_argument("--status", help="Status: incomplete, completed, canceled")
    p.add_argument("--start-date", help="Start date YYYY-MM-DD")
    p.add_argument("--deadline", help="Deadline YYYY-MM-DD")
    p.add_argument("--tag", help="Tag title")
    p.add_argument("--area-uuid", help="Area UUID")
    p.add_argument("--type", help="Item type: to-do, project, heading")
    p.set_defaults(func=cmd_search_advanced)

    # Writes via URL scheme
    p = sub.add_parser("add-todo", help="Create a new todo (via Things URL scheme)")
    p.add_argument("--title", required=True, help="Todo title")
    p.add_argument("--notes", help="Todo notes")
    p.add_argument("--when", help="today, tomorrow, evening, anytime, someday, or YYYY-MM-DD")
    p.add_argument("--deadline", help="Deadline YYYY-MM-DD")
    p.add_argument("--tag", action="append", help="Tag(s); repeat or use comma-separated")
    p.add_argument("--checklist", action="append", help="Checklist item; repeat for multiple")
    p.add_argument("--list-id", help="Project/area UUID to add into")
    p.add_argument("--list-title", help="Project/area title to add into")
    p.add_argument("--heading", help="Heading title to add under")
    p.add_argument("--heading-id", help="Heading UUID to add under (takes precedence over --heading)")
    p.add_argument("--dry-run", action="store_true", help="Print the generated Things URL, do not open Things")
    p.set_defaults(func=cmd_add_todo)

    p = sub.add_parser("add-project", help="Create a new project (via Things URL scheme)")
    p.add_argument("--title", required=True, help="Project title")
    p.add_argument("--notes", help="Project notes")
    p.add_argument("--when", help="today, tomorrow, evening, anytime, someday, or YYYY-MM-DD")
    p.add_argument("--deadline", help="Deadline YYYY-MM-DD")
    p.add_argument("--tag", action="append", help="Tag(s); repeat or use comma-separated")
    p.add_argument("--area-id", help="Area UUID to add into")
    p.add_argument("--area-title", help="Area title to add into")
    p.add_argument("--todo", action="append", help="Initial todo title; repeat for multiple")
    p.add_argument("--dry-run", action="store_true", help="Print the generated Things URL, do not open Things")
    p.set_defaults(func=cmd_add_project)

    p = sub.add_parser("update-todo", help="Update an existing todo (via Things URL scheme)")
    p.add_argument("--id", required=True, help="Todo UUID")
    p.add_argument("--title", help="New title")
    p.add_argument("--notes", help="New notes")
    p.add_argument("--when", help="New schedule")
    p.add_argument("--deadline", help="New deadline YYYY-MM-DD")
    p.add_argument("--tag", action="append", help="Tag(s); repeat or use comma-separated")
    p.add_argument("--completed", action="store_true", help="Mark as completed")
    p.add_argument("--canceled", action="store_true", help="Mark as canceled")
    p.add_argument("--list", help="Move into a project/area by title")
    p.add_argument("--list-id", help="Move into a project/area by UUID (takes precedence over --list)")
    p.add_argument("--heading", help="Move under a heading by title")
    p.add_argument("--heading-id", help="Move under a heading by UUID (takes precedence over --heading)")
    p.add_argument("--dry-run", action="store_true", help="Print the generated Things URL, do not open Things")
    p.set_defaults(func=cmd_update_todo)

    p = sub.add_parser("update-project", help="Update an existing project (via Things URL scheme)")
    p.add_argument("--id", required=True, help="Project UUID")
    p.add_argument("--title", help="New title")
    p.add_argument("--notes", help="New notes")
    p.add_argument("--when", help="New schedule")
    p.add_argument("--deadline", help="New deadline YYYY-MM-DD")
    p.add_argument("--tag", action="append", help="Tag(s); repeat or use comma-separated")
    p.add_argument("--completed", action="store_true", help="Mark as completed")
    p.add_argument("--canceled", action="store_true", help="Mark as canceled")
    p.add_argument("--dry-run", action="store_true", help="Print the generated Things URL, do not open Things")
    p.set_defaults(func=cmd_update_project)

    # Open in Things
    p = sub.add_parser("show", help="Open a list/item in Things")
    p.add_argument("id", help="UUID or list id (inbox, today, upcoming, anytime, someday, logbook)")
    p.add_argument("--query", help="Optional query filter")
    p.add_argument("--filter-tag", action="append", help="Filter tag(s); repeat or use comma-separated")
    p.add_argument("--dry-run", action="store_true", help="Print the generated Things URL, do not open Things")
    p.set_defaults(func=cmd_show)

    p = sub.add_parser("search-items", help="Open Things search UI for a query")
    p.add_argument("query", help="Search query")
    p.add_argument("--dry-run", action="store_true", help="Print the generated Things URL, do not open Things")
    p.set_defaults(func=cmd_search_items)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except BrokenPipeError:
        return 0
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
