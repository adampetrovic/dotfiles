import urllib.parse
import webbrowser
import subprocess
import things
from typing import Any, Dict, Optional


def execute_url(url: str) -> None:
    """Execute a Things URL."""
    try:
        subprocess.run(
            ["osascript", "-e", f'tell application "Things3" to open location "{url}"'],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError:
        webbrowser.open(url)


def construct_url(command: str, params: Dict[str, Any]) -> str:
    """Construct a Things URL from command and parameters."""
    url = f"things:///{command}"

    if command in ["update", "update-project"]:
        token = things.token()
        if token:
            params["auth-token"] = token

    if params:
        encoded_params = []
        for key, value in params.items():
            if value is None:
                continue
            if isinstance(value, bool):
                value = str(value).lower()
            elif isinstance(value, list):
                value = ",".join(str(v) for v in value)
            encoded_params.append(f"{key}={urllib.parse.quote(str(value))}")

        url += "?" + "&".join(encoded_params)

    return url


def add_todo(
    title: str,
    notes: Optional[str] = None,
    when: Optional[str] = None,
    deadline: Optional[str] = None,
    tags: Optional[list[str]] = None,
    checklist_items: Optional[list[str]] = None,
    list_id: Optional[str] = None,
    list_title: Optional[str] = None,
    heading: Optional[str] = None,
    heading_id: Optional[str] = None,
    completed: Optional[bool] = None,
) -> str:
    """Construct URL to add a new todo."""
    params = {
        "title": title,
        "notes": notes,
        "when": when,
        "deadline": deadline,
        "checklist-items": "\n".join(checklist_items) if checklist_items else None,
        "list-id": list_id,
        "list": list_title,
        "heading": heading,
        "heading-id": heading_id,
        "completed": completed,
    }

    if tags:
        params["tags"] = ",".join(tags)
    return construct_url("add", {k: v for k, v in params.items() if v is not None})


def add_project(
    title: str,
    notes: Optional[str] = None,
    when: Optional[str] = None,
    deadline: Optional[str] = None,
    tags: Optional[list[str]] = None,
    area_id: Optional[str] = None,
    area_title: Optional[str] = None,
    todos: Optional[list[str]] = None,
) -> str:
    """Construct URL to add a new project."""
    params = {
        "title": title,
        "notes": notes,
        "when": when,
        "deadline": deadline,
        "area-id": area_id,
        "area": area_title,
        "to-dos": "\n".join(todos) if todos else None,
    }

    if tags:
        params["tags"] = ",".join(tags)

    return construct_url("add-project", {k: v for k, v in params.items() if v is not None})


def update_todo(
    id: str,
    title: Optional[str] = None,
    notes: Optional[str] = None,
    when: Optional[str] = None,
    deadline: Optional[str] = None,
    tags: Optional[list[str]] = None,
    completed: Optional[bool] = None,
    canceled: Optional[bool] = None,
    list: Optional[str] = None,
    list_id: Optional[str] = None,
    heading: Optional[str] = None,
    heading_id: Optional[str] = None,
) -> str:
    """Construct URL to update an existing todo.

    Note: list_id takes precedence over list if both are provided.
    """
    params = {
        "id": id,
        "title": title,
        "notes": notes,
        "when": when,
        "deadline": deadline,
        "tags": tags,
        "completed": completed,
        "canceled": canceled,
        "list": list,
        "list-id": list_id,
        "heading": heading,
        "heading-id": heading_id,
    }
    return construct_url("update", {k: v for k, v in params.items() if v is not None})


def update_project(
    id: str,
    title: Optional[str] = None,
    notes: Optional[str] = None,
    when: Optional[str] = None,
    deadline: Optional[str] = None,
    tags: Optional[list[str]] = None,
    completed: Optional[bool] = None,
    canceled: Optional[bool] = None,
) -> str:
    """Construct URL to update an existing project."""
    params = {
        "id": id,
        "title": title,
        "notes": notes,
        "when": when,
        "deadline": deadline,
        "tags": tags,
        "completed": completed,
        "canceled": canceled,
    }
    return construct_url("update-project", {k: v for k, v in params.items() if v is not None})


def show(id: str, query: Optional[str] = None, filter_tags: Optional[list[str]] = None) -> str:
    """Construct URL to show a specific item or list."""
    params = {"id": id, "query": query, "filter": filter_tags}
    return construct_url("show", {k: v for k, v in params.items() if v is not None})


def search(query: str) -> str:
    """Construct URL to perform a search."""
    return construct_url("search", {"query": query})

