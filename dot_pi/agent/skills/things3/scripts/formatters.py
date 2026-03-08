import logging
from datetime import datetime

import things

logger = logging.getLogger(__name__)


def _calculate_age(date_str: str) -> str:
    date_obj = datetime.fromisoformat(str(date_str))
    age = datetime.now() - date_obj
    days = age.days

    if days == 0:
        return "today"
    if days == 1:
        return "1 day ago"
    if days < 7:
        return f"{days} days ago"
    if days < 30:
        weeks = days // 7
        return f"{weeks} week{'s' if weeks > 1 else ''} ago"
    if days < 365:
        months = days // 30
        return f"{months} month{'s' if months > 1 else ''} ago"
    years = days // 365
    return f"{years} year{'s' if years > 1 else ''} ago"


def format_todo(todo: dict) -> str:
    logger.debug("Formatting todo: %s", todo)
    todo_text = f"Title: {todo['title']}"

    todo_text += f"\nUUID: {todo['uuid']}"
    todo_text += f"\nType: {todo['type']}"

    if todo.get("status"):
        todo_text += f"\nStatus: {todo['status']}"

    if todo.get("start"):
        todo_text += f"\nList: {todo['start']}"

    if todo.get("start_date"):
        todo_text += f"\nStart Date: {todo['start_date']}"
    if todo.get("deadline"):
        todo_text += f"\nDeadline: {todo['deadline']}"
    if todo.get("stop_date"):
        todo_text += f"\nCompleted: {todo['stop_date']}"

    if todo.get("created"):
        todo_text += f"\nCreated: {todo['created']}"
        try:
            todo_text += f"\nAge: {_calculate_age(todo['created'])}"
        except (ValueError, TypeError):
            pass

    if todo.get("modified"):
        todo_text += f"\nModified: {todo['modified']}"
        try:
            todo_text += f"\nLast modified: {_calculate_age(todo['modified'])}"
        except (ValueError, TypeError):
            pass

    if todo.get("notes"):
        todo_text += f"\nNotes: {todo['notes']}"

    if todo.get("project"):
        try:
            project = things.get(todo["project"])
            if project:
                todo_text += f"\nProject: {project['title']}"
        except Exception:
            pass

    if todo.get("heading"):
        try:
            heading = things.get(todo["heading"])
            if heading:
                todo_text += f"\nHeading: {heading['title']}"
        except Exception:
            pass

    if todo.get("area"):
        try:
            area = things.get(todo["area"])
            if area:
                todo_text += f"\nArea: {area['title']}"
        except Exception:
            pass

    if todo.get("tags"):
        todo_text += f"\nTags: {', '.join(todo['tags'])}"

    if isinstance(todo.get("checklist"), list):
        todo_text += "\nChecklist:"
        for item in todo["checklist"]:
            checkbox = "✓" if item.get("status") == "completed" else "☐"
            todo_text += f"\n  {checkbox} {item['title']}"

    return todo_text


def format_project(project: dict, include_items: bool = False) -> str:
    project_text = f"Title: {project['title']}\nUUID: {project['uuid']}"

    if project.get("area"):
        try:
            area = things.get(project["area"])
            if area:
                project_text += f"\nArea: {area['title']}"
        except Exception:
            pass

    if project.get("notes"):
        project_text += f"\nNotes: {project['notes']}"

    if project.get("created"):
        project_text += f"\nCreated: {project['created']}"
        try:
            project_text += f"\nAge: {_calculate_age(project['created'])}"
        except (ValueError, TypeError):
            pass

    if project.get("modified"):
        project_text += f"\nModified: {project['modified']}"
        try:
            project_text += f"\nLast modified: {_calculate_age(project['modified'])}"
        except (ValueError, TypeError):
            pass

    headings = things.tasks(type="heading", project=project["uuid"])
    if headings:
        project_text += "\n\nHeadings:"
        for heading in headings:
            project_text += f"\n- {heading['title']}"

    if include_items:
        todos = things.todos(project=project["uuid"])
        if todos:
            project_text += "\n\nTasks:"
            for todo in todos:
                project_text += f"\n- {todo['title']}"

    return project_text


def format_area(area: dict, include_items: bool = False) -> str:
    area_text = f"Title: {area['title']}\nUUID: {area['uuid']}"

    if area.get("notes"):
        area_text += f"\nNotes: {area['notes']}"

    if area.get("created"):
        area_text += f"\nCreated: {area['created']}"
        try:
            area_text += f"\nAge: {_calculate_age(area['created'])}"
        except (ValueError, TypeError):
            pass

    if area.get("modified"):
        area_text += f"\nModified: {area['modified']}"
        try:
            area_text += f"\nLast modified: {_calculate_age(area['modified'])}"
        except (ValueError, TypeError):
            pass

    if include_items:
        projects = things.projects(area=area["uuid"])
        if projects:
            area_text += "\n\nProjects:"
            for project in projects:
                area_text += f"\n- {project['title']}"

        todos = things.todos(area=area["uuid"])
        if todos:
            area_text += "\n\nTasks:"
            for todo in todos:
                area_text += f"\n- {todo['title']}"

    return area_text


def format_tag(tag: dict, include_items: bool = False) -> str:
    tag_text = f"Title: {tag['title']}\nUUID: {tag['uuid']}"

    if tag.get("shortcut"):
        tag_text += f"\nShortcut: {tag['shortcut']}"

    if include_items:
        todos = things.todos(tag=tag["title"])
        if todos:
            tag_text += "\n\nTagged Items:"
            for todo in todos:
                tag_text += f"\n- {todo['title']}"

    return tag_text


def format_heading(heading: dict, include_items: bool = False) -> str:
    heading_text = f"Title: {heading['title']}\nUUID: {heading['uuid']}"
    heading_text += "\nType: heading"

    if heading.get("project"):
        if heading.get("project_title"):
            heading_text += f"\nProject: {heading['project_title']}"
        else:
            try:
                project = things.get(heading["project"])
                if project:
                    heading_text += f"\nProject: {project['title']}"
            except Exception:
                pass

    if heading.get("created"):
        heading_text += f"\nCreated: {heading['created']}"
        try:
            heading_text += f"\nAge: {_calculate_age(heading['created'])}"
        except (ValueError, TypeError):
            pass

    if heading.get("modified"):
        heading_text += f"\nModified: {heading['modified']}"
        try:
            heading_text += f"\nLast modified: {_calculate_age(heading['modified'])}"
        except (ValueError, TypeError):
            pass

    if heading.get("notes"):
        heading_text += f"\nNotes: {heading['notes']}"

    if include_items:
        todos = things.todos(heading=heading["uuid"])
        if todos:
            heading_text += "\n\nTasks under heading:"
            for todo in todos:
                heading_text += f"\n- {todo['title']}"

    return heading_text

