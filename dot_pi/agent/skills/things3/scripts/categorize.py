#!/usr/bin/env python3
"""Ask an LLM to categorize a todo into the user's Things 3 structure.

Returns a JSON object with recommended: area, project, when, tags, heading.
Called by things_cli.py before creating/updating todos.
"""
from __future__ import annotations

import json
import subprocess
import sys
from typing import Optional


def _run_things(*args: str) -> str:
    """Run the things CLI and return stdout."""
    script = subprocess.run(
        [sys.executable, __file__.replace("categorize.py", "things_cli.py"), *args],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return script.stdout.strip()


def _gather_context() -> str:
    """Gather the user's current Things structure for LLM context."""
    import things  # type: ignore

    lines: list[str] = []

    # Areas
    areas = things.areas() or []
    lines.append("## Areas")
    for a in areas:
        lines.append(f"- {a['title']} (UUID: {a['uuid']})")

    # Projects (with area and status)
    projects = things.projects() or []
    lines.append("\n## Projects")
    for p in projects:
        area_title = ""
        if p.get("area"):
            try:
                area_obj = things.get(p["area"])
                if area_obj:
                    area_title = f" [Area: {area_obj['title']}]"
            except Exception:
                pass
        start = p.get("start", "")
        lines.append(f"- {p['title']} (UUID: {p['uuid']}){area_title} — List: {start}")

    # Tags
    tags = things.tags() or []
    lines.append("\n## Tags")
    for t in tags:
        shortcut = f" (shortcut: {t['shortcut']})" if t.get("shortcut") else ""
        lines.append(f"- {t['title']}{shortcut}")

    # Headings (grouped by project)
    headings = things.tasks(type="heading") or []
    if headings:
        lines.append("\n## Headings")
        for h in headings:
            proj_name = ""
            if h.get("project"):
                try:
                    proj = things.get(h["project"])
                    if proj:
                        proj_name = f" [Project: {proj['title']}]"
                except Exception:
                    pass
            lines.append(f"- {h['title']} (UUID: {h['uuid']}){proj_name}")

    return "\n".join(lines)


def _build_system_prompt(context: str) -> str:
    return f"""You are a Things 3 task categorisation assistant. Given the user's Things structure below, recommend the best placement and metadata for a new todo.

{context}

## Tag meanings
- ⚡️ quick — can be done in under 5 minutes
- 🧠 deep — requires focused concentration / deep work
- 🚫 blocked — waiting on something external before this can proceed
- 🛒 errand — requires going somewhere physically
- ☎️ call — requires a phone call
- 🎟️ ticket — has an associated support ticket / issue
- 💻 desk — needs to be done at a computer
- 🏠 home — needs to be done at home
- 👋 waiting — delegated / waiting for someone else
- 🔥 urgent — time-sensitive, needs attention ASAP

## When values
- "today" — should be done today
- "tomorrow" — should be done tomorrow
- "anytime" — no specific date, do whenever
- "someday" — aspirational / low priority / not committed
- "YYYY-MM-DD" — specific future date
- null — leave unscheduled (defaults to Inbox)

## Rules
1. Pick the most specific project that fits. If none fit, pick the area only.
2. If a project has headings, pick the right heading if applicable.
3. Assign 1-3 tags that best describe the nature of the work.
4. Set "when" based on urgency/priority implied by the task description.
5. If the task clearly belongs in a Someday project, set when to "someday".
6. If unsure about any field, set it to null rather than guessing wrong.
7. Return ONLY valid JSON, no markdown fences, no explanation."""


def categorize(
    title: str,
    notes: Optional[str] = None,
    model: str = "anthropic/haiku",
) -> dict:
    """Ask an LLM to categorize a todo. Returns a dict with recommendations."""
    context = _gather_context()
    system_prompt = _build_system_prompt(context)

    user_msg = f"Title: {title}"
    if notes:
        user_msg += f"\nNotes: {notes}"

    user_msg += """

Return a JSON object with these fields:
{
  "area_title": "area name or null",
  "area_uuid": "area UUID or null",
  "project_title": "project name or null",
  "project_uuid": "project UUID or null",
  "heading_title": "heading name or null",
  "heading_uuid": "heading UUID or null",
  "when": "today|tomorrow|anytime|someday|YYYY-MM-DD|null",
  "tags": ["tag1", "tag2"],
  "reasoning": "one sentence explaining your choices"
}"""

    result = subprocess.run(
        [
            "pi",
            "--print",
            "--no-session",
            "--no-tools",
            "--no-extensions",
            "--no-skills",
            "--no-prompt-templates",
            "--model", model,
            "--thinking", "off",
            "--system-prompt", system_prompt,
            user_msg,
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        print(f"Error calling LLM: {result.stderr}", file=sys.stderr)
        return {}

    raw = result.stdout.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"Failed to parse LLM response:\n{raw}", file=sys.stderr)
        return {}


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Categorize a Things 3 todo using an LLM")
    parser.add_argument("--title", required=True, help="Todo title")
    parser.add_argument("--notes", help="Todo notes")
    parser.add_argument("--model", default="anthropic/haiku", help="LLM model to use (default: anthropic/haiku)")
    parser.add_argument("--context-only", action="store_true", help="Print gathered context and exit")
    args = parser.parse_args()

    if args.context_only:
        print(_gather_context())
        return 0

    result = categorize(title=args.title, notes=args.notes, model=args.model)
    if result:
        print(json.dumps(result, indent=2))
    else:
        print("Failed to categorize", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
