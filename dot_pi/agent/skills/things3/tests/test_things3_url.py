from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import pathlib
import subprocess
import sys
import unittest
import urllib.parse
from unittest import mock


SCRIPTS = pathlib.Path(__file__).resolve().parent.parent / "scripts"
MODULE_PATH = SCRIPTS / "executable_things3-url.py"
if not MODULE_PATH.exists():
    MODULE_PATH = SCRIPTS / "things3-url.py"
SPEC = importlib.util.spec_from_file_location("executable_things3_url", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
things = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(things)


class ResolveContainerTests(unittest.TestCase):
    @unittest.skipUnless(sys.platform == "darwin", "AppleScriptObjC requires macOS")
    def test_json_bridge_executes_without_accessing_things(self):
        with mock.patch.object(things, "run_osascript", return_value="[]") as run:
            things.get_container_records()
        script = run.call_args.args[0]
        start = script.index('tell application "Things3"')
        end = script.index("end tell", start) + len("end tell")
        # Replace all application access with synthetic records, retaining the
        # actual Foundation bridge (and its AppleScript syntax).
        probe = script[:start] + (
            'set containerRows to {{"area", "💼 Work"}, '
            '{"project", "line" & linefeed & "tab" & tab & "quote" & quote}}'
        ) + script[end:]
        result = subprocess.run(
            ["osascript", "-"], input=probe, text=True,
            capture_output=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            json.loads(result.stdout),
            [["area", "💼 Work"], ["project", 'line\ntab\tquote"']],
        )

    def resolve(self, name, records):
        with mock.patch.object(things, "run_osascript", return_value=json.dumps(records)) as run:
            try:
                return things.resolve_container(name)
            finally:
                run.assert_called_once()
                script = run.call_args.args[0]
                self.assertIn("repeat with x in areas", script)
                self.assertIn("repeat with x in projects", script)
                self.assertIn("NSJSONSerialization", script)

    def test_exact_area_precedes_same_named_project(self):
        self.assertEqual(self.resolve("Work", [["area", "Work"], ["project", "Work"]]), ("area", "Work"))

    def test_exact_project_when_no_exact_area(self):
        self.assertEqual(self.resolve("Work", [["area", "Other"], ["project", "Work"]]), ("project", "Work"))

    def test_fuzzy_emoji_name(self):
        self.assertEqual(self.resolve("Work", [["area", "💼 Work"]]), ("area", "💼 Work"))

    def test_unique_substring(self):
        self.assertEqual(self.resolve("Design", [["project", "Product Design"]]), ("project", "Product Design"))

    def test_ambiguity_mentions_both_kinds(self):
        with self.assertRaises(SystemExit) as caught:
            self.resolve("Work", [["area", "Work Team"], ["project", "Work Project"]])
        self.assertIn("area: Work Team", str(caught.exception))
        self.assertIn("project: Work Project", str(caught.exception))

    def test_empty_and_unmatched_records(self):
        with self.assertRaisesRegex(SystemExit, "No Things areas/projects found"):
            self.resolve("Work", [])
        with self.assertRaisesRegex(SystemExit, "Could not find"):
            self.resolve("Work", [["area", "Home"]])

    def test_whitespace_names_are_filtered(self):
        self.assertEqual(self.resolve("Work", [["area", " \t\n"], ["project", "Work"]]), ("project", "Work"))

    def test_json_names_preserve_exact_content(self):
        name = '  line\n tab\t quote" slash\\ unicode ☃  '
        self.assertEqual(self.resolve(name, [["project", name]]), ("project", name))

    def test_invalid_structured_responses(self):
        for response in ({"area": "Work"}, [["area"]], [["other", "Work"]], [["area", 7]]):
            with self.subTest(response=response), mock.patch.object(
                things, "run_osascript", return_value=json.dumps(response)
            ):
                with self.assertRaises(SystemExit):
                    things.resolve_container("Work")

    def test_invalid_json_response(self):
        with mock.patch.object(things, "run_osascript", return_value="not JSON"):
            with self.assertRaisesRegex(SystemExit, "Invalid Things container discovery response"):
                things.resolve_container("Work")

    def test_each_resolution_discovers_fresh_values(self):
        run = mock.Mock(side_effect=[json.dumps([["area", "One"]]), json.dumps([["area", "Two"]])])
        with mock.patch.object(things, "run_osascript", run):
            self.assertEqual(things.resolve_container("One"), ("area", "One"))
            self.assertEqual(things.resolve_container("Two"), ("area", "Two"))
        self.assertEqual(run.call_count, 2)

    def test_get_named_records_keeps_single_kind_query(self):
        for kind in ("areas", "projects"):
            with self.subTest(kind=kind), mock.patch.object(
                things, "run_osascript", return_value="First\n \nSecond\n"
            ) as run:
                self.assertEqual(things.get_named_records(kind), ["First", "Second"])
                run.assert_called_once()
                self.assertIn(f"repeat with x in {kind}", run.call_args.args[0])
                other = "projects" if kind == "areas" else "areas"
                self.assertNotIn(f"repeat with x in {other}", run.call_args.args[0])


class AddTodoTests(unittest.TestCase):
    def args(self, **kwargs):
        values = dict(
            title="Task",
            notes=None,
            when=None,
            deadline=None,
            tag=[],
            list="Work",
            heading=None,
            checklist=[],
            dry_run=False,
        )
        values.update(kwargs)
        return argparse.Namespace(**values)

    def test_add_todo_dry_run_and_fields(self):
        events = []
        with (
            mock.patch.object(things, "run_osascript", side_effect=[
                json.dumps([["project", "Work"]]), "1", "Task | project: Work\n"
            ]) as script,
            mock.patch.object(things, "run_open", side_effect=lambda url, dry: events.append(("open", url, dry))),
            mock.patch("time.sleep", side_effect=lambda seconds: events.append(("sleep", seconds))),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            # time is imported inside add_todo, so patch the shared module.
            things.add_todo(self.args(
                notes="Notes", when="today", deadline="2025-01-02", tag=["tag"],
                heading="Heading", checklist=["Check"], dry_run=True,
            ))
        self.assertEqual(script.call_count, 1)
        self.assertEqual([event[0] for event in events], ["open"])
        self.assertTrue(events[0][2])
        params = urllib.parse.parse_qs(urllib.parse.urlsplit(events[0][1]).query)
        self.assertEqual(params["title"], ["Task"])
        self.assertEqual(params["notes"], ["Notes"])
        self.assertEqual(params["deadline"], ["2025-01-02"])
        self.assertEqual(params["when"], ["today"])
        self.assertEqual(params["tags"], ["tag"])
        self.assertEqual(params["heading"], ["Heading"])
        self.assertEqual(json.loads(params["checklist-items"][0]), ["Check"])

    def test_add_todo_real_sequence_and_zero_move_stops_verification(self):
        events = []
        responses = iter([json.dumps([["area", "Work"]]), "1", "Located"])

        def run_script(script):
            events.append(("script", script))
            return next(responses)

        with (
            mock.patch.object(things, "run_osascript", side_effect=run_script) as script,
            mock.patch.object(things, "run_open", side_effect=lambda url, dry: events.append(("open",))),
            mock.patch("time.sleep", side_effect=lambda seconds: events.append(("sleep", seconds))),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            things.add_todo(self.args())
        self.assertEqual([event[0] for event in events], ["script", "open", "sleep", "script", "script"])
        self.assertIn("NSJSONSerialization", events[0][1])
        self.assertIn("move t to targetContainer", events[3][1])
        self.assertIn('set location to "Inbox"', events[4][1])
        self.assertEqual(script.call_count, 3)

        with (
            mock.patch.object(things, "run_osascript", side_effect=[
                json.dumps([["area", "Work"]]), "0"
            ]) as script,
            mock.patch.object(things, "run_open"),
            mock.patch("time.sleep"),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            with self.assertRaises(SystemExit):
                things.add_todo(self.args())
        self.assertEqual(script.call_count, 2)


class ImportJsonTests(unittest.TestCase):
    def test_import_stdin_list_and_wrapped_object(self):
        payload = [
            {"type": "to-do", "attributes": {"title": "one"}},
            {"type": "to-do", "attributes": {"title": ' two "☃" '}},
        ]
        for source in (payload, payload[0]):
            opened = []
            with (
                mock.patch.object(things, "run_open", side_effect=lambda url, dry: opened.append(url)),
                mock.patch.object(sys, "stdin", io.StringIO(json.dumps(source))),
            ):
                things.import_json(argparse.Namespace(file="-", dry_run=False))
            self.assertEqual(len(opened), 1)
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(opened[0]).query)
            decoded = json.loads(query["data"][0])
            self.assertEqual(decoded, source if isinstance(source, list) else [source])

    def test_invalid_top_level_json_does_not_open(self):
        with mock.patch.object(things, "run_open") as opened, mock.patch.object(
            sys, "stdin", io.StringIO('"not a list"')
        ):
            with self.assertRaises(SystemExit):
                things.import_json(argparse.Namespace(file="-", dry_run=False))
        opened.assert_not_called()

    def test_dry_run_uses_actual_run_open_without_opening_subprocess(self):
        payload = [
            {"type": "to-do", "attributes": {"title": "one"}},
            {"type": "to-do", "attributes": {"title": "two"}},
        ]
        completed = mock.Mock(stdout="")
        with (
            mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))),
            mock.patch.object(things.subprocess, "run", return_value=completed) as run,
            contextlib.redirect_stdout(io.StringIO()) as output,
        ):
            things.import_json(argparse.Namespace(file="-", dry_run=True))
        run.assert_not_called()
        printed_url = output.getvalue().strip()
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(printed_url).query)
        self.assertEqual(json.loads(query["data"][0]), payload)


if __name__ == "__main__":
    unittest.main()
