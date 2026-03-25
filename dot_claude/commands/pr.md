---
description: Generate PR title and summary from branch changes
argument-hint: [additional-context]
--

## Context

- Current jj diff of changes: !`jj diff -r 'change()' --color never --git --no-pager`
- Commit messages: !`jj log -r 'change()' --color never --no-pager`

Generate a pull request title and summary based on the changes in the current branch.

**IMPORTANT: Use ONLY the diff and commit messages provided above in the Context section. Do NOT run additional git/jj commands.**

## Analysis Steps

2. Generate PR Title:
   - Keep under 72 characters
   - Be specific but concise
   - Include the JIRA ticket in the title if any of the commit messages contain a JIRA ticket
   - Include risk in the PR title based off your determination

3. Generate PR Summary with these sections:

   ### What is this change proposing?
   - 2-3 bullet points describing WHAT changed and WHY
   - Focus on user-facing impacts and business value

   ### How was the change tested?
   - How changes were validated
   - New tests added
   - Manual testing performed

   ### Risk?
   - One of "low-risk", "medium-risk", "high-risk"
   - Any backwards incompatibility
   - Complex code paths
   - If a measured, orchestrated roll-out is necessary
   - Migration steps if needed

## Output Format

```
[risk] JIRA-ISSUE: [title]

### What is this change proposing?
[bullet points]

### How was the change tested?
[validation approach]

### Risk?
["low-risk", "medium-risk", "high-risk"]
[explanation of how that was determined]
```

Focus area (if specified): $ARGUMENTS
