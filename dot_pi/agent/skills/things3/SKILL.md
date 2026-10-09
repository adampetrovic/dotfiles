---
name: things3
description: "Follow Adam's Things 3 workflow for capturing tasks, clarifying Inbox items, cleanup, daily/weekly reviews, prioritisation, and selecting eligible next actions. Use whenever reading or managing Things tasks, projects, areas, or lists. Interact exclusively through the Things3 MCP."
---

# Things 3 methodology

This skill documents Adam's workflow; it is not another integration. Use only the `mcp__things3` MCP tools for Things reads and changes. Discover tools with codemode `searchTools` and inspect their declarations before calling them. Do not use AppleScript, direct database access, URL schemes, or another CLI as a fallback. If MCP cannot express a change, explain the limitation and ask how to proceed.

Inspired by [The Fu Master Productivity Checklist](https://productivewithapurpose.com/2019/05/21/the-fu-master-productivity-checklist-using-things3/). Adam's rules below override the article. Do not import its tags, morning routines, calendar practices, or notes-app choices without agreement.

## Non-negotiable defaults

- **Inbox is a braindump.** Capture thoughts promptly without demanding actionable wording, categorisation, clarification, or deduplication. New tasks go here unless Adam explicitly requests a different destination or list. Preserve supplied context in notes; do not embellish or invent commitments. Briefly confirm capture.
- **Areas are the default home for processed tasks; projects are strictly timebound goals.** Ongoing themes such as home maintenance or home automation belong directly in their areas, not in evergreen project containers. Create a project only for a finite multi-action outcome with an agreed timeframe/end point. Never invent a deadline or scheduled start just to qualify something as a project. Use agreed tags sparingly for thematic grouping instead of evergreen projects; do not automatically create or apply tags.
- **Today means TODAY.** Keep it limited to what Adam intends to accomplish today. Importance alone is not permission to add something to Today.
- **Anytime means this week's actionable work, not today.** This week is Monday–Sunday in Australia/Sydney, not a rolling seven days. Once Today is finished, Anytime is the next source of work.
- **Someday means outside this week's focus.** It is deliberately deferred work, not an idea graveyard; revisit it during weekly reviews. Blocked or speculative future steps may live here or in project notes.
- **Only actionable next steps belong in Today/Anytime.** Exclude tasks awaiting prerequisites, decisions, another person, unavailable resources, or a future availability date when recommending eligible work.
- **ALMOST NEVER SCHEDULE TODOS.** Future start dates are for genuine "cannot act before this date" constraints, or an explicit request. Never schedule merely to make a task resurface, spread workload across arbitrary dates, or compensate for distrust of Anytime.
- **Due dates mean genuine deadlines.** Prefer a deadline over a scheduled start when a real due date exists. Do not manufacture due dates from priority, weekly focus, or "I'd like to do this". A deadline and an earliest possible start are independent constraints; clarify when ambiguous.
- Use Sydney time for today and relative dates. Determine the current date when needed; confirm ambiguous dates. Weekly boundaries do not authorise automatic list changes.

## Areas and project placement

Read `references/areas.md` when categorising. Refresh live areas and projects through MCP before applying placement; resolve current IDs, do not hardcode them. Ask when a task crosses categories. Do not create, rename, or reorganise areas without approval.

## Capture

For "add a task", "remind me", or a new thought:
1. Create in Inbox by default, with the supplied title/context. Do not search for duplicates as a prerequisite.
2. Honour explicit destinations, list choices, and genuine deadlines; clarify only ambiguity that prevents the requested operation. Unresolved categorisation must not block Inbox capture.
3. Do not add tags, reminders, start dates, or a project unless requested or agreed during processing.
4. Verify creation and briefly report where it landed and any dates set.

## Inbox clarification: one item at a time

Read one open Inbox item, including notes. Do not present a batch unless Adam asks.

Ask only what is missing, in a natural conversation:
- **What?** What does this mean? What outcome would make it done? Keep, cull, reference-only, or actionable?
- **How?** What is the next concrete action? Is it a task or a genuinely timebound multi-step outcome? What context/checklist would help? Is it blocked?
- **Where?** Which area fits by default? Use an existing project only if the task contributes to its timebound outcome. Suggest a destination with a short reason rather than making Adam classify from scratch.
- **When?** Today, the remainder of this Monday–Sunday week (Anytime), or outside this week (Someday)? Is there a real deadline? A genuine earliest possible start?

Do not repeatedly ask about facts already supplied. Start with the meaning/outcome if the item is vague; only ask follow-ups needed to resolve the item. Use structured questions when concrete choices are needed, with a custom-answer path available. Keep the interrogation lightweight.

Once clear, summarise the proposed actionable title, placement, list, deadline (or none), and any notes. Apply agreed changes, verify them, and then proceed to the next item. Leave unresolved items in Inbox. Never invent details or silently delete an unclear thought. Keep possible future project steps in notes/Someday; each active project should have an eligible next action, or a clearly identified blocker.

## Prioritisation and selecting eligible tasks

1. Start with Today. If Today is finished, inspect Anytime. If Adam explicitly asks to replan, review both without silently changing them.
2. Ask about available time, energy, context, and constraints only where needed. Do not invent estimates or assume all tasks are currently doable.
3. Assess eligibility before ranking: actionable, unblocked, resources available, and no unmet earliest-start constraint. Check project context and inherited constraints where available.
4. Offer a short ranked shortlist with reasons: genuine deadline risk, impact, commitments, fit for current capacity, and balance across relevant areas. Flag urgent/overdue but blocked work separately rather than pretending it is executable.
5. Recommend, don't automatically promote tasks into Today or assign dates. If Today is unrealistic, propose removing optional items to Anytime or Someday based on weekly intent.

## Cleanup and reviews

A broad cleanup request authorises inspection and proposals, not unrestricted mutation. Read relevant lists, areas, projects, notes, and dates; paginate when necessary and state any coverage limits.

**Daily review:** clarify Inbox one item at a time; inspect Today for relevance, capacity, and rollover; check genuine deadlines; consider necessary Anytime actions. Keep Today intentionally small. Do not access email/calendar or create time blocks unless asked.

**Weekly review:** review area by area, project by project, including Someday. Set the Monday–Sunday focus with Adam. Propose promoting selected Someday work into Anytime and deferring work outside this week's focus. Check active projects for a next action/blocker. Briefly surface accomplishments if requested.

**Cleanup signals:** stale commitments, duplicates, vague wording, speculative or blocked active tasks, overloaded Today/Anytime, arbitrary future starts, evergreen projects without an agreed timeframe, and projects without next actions. Existing placement/dates may reflect deliberate decisions: flag inconsistencies, do not assume they are mistakes.

Offer a bounded change plan. Get agreement before ambiguous moves, merging, deleting/cancelling/completing tasks, clearing dates, creating projects/areas, or broad restructuring. Preserve useful notes/checklists when merging and confirm what will be retained. Reuse existing tags sparingly; do not adopt a new tagging system without agreement.

## Mutation discipline

- Explicit instructions authorise the specified change; do not add redundant confirmation to straightforward capture or an already agreed edit.
- Read affected existing items before editing. Send only intended fields and preserve unrelated notes, dates, tags, and checklist content.
- When removing an evergreen project, first identify its actual tasks, move them directly into the appropriate area, preserve project-level context and inherited metadata where relevant, and verify preservation before trashing the empty container. Check actual task project IDs: do not trust filters that return unrelated tasks.
- Inspect live MCP schemas. Distinguish deadline from start/when date. Do not assume an ISO-date field accepts `today`, `anytime`, or `someday`, or that clearing a date necessarily changes list membership correctly. Find the supported operation; if unavailable, stop and explain.
- Verify destination, list membership, dates, and preserved context after mutations. A successful tool call alone is not proof of correct placement.
- On partial failure, report actual changes and remaining work; do not claim the whole operation succeeded. Avoid blindly retrying creation or destructive operations.
- End with a concise summary of changes and unresolved questions. Never mark a task complete just because it was discussed, scheduled, or put on a calendar.
