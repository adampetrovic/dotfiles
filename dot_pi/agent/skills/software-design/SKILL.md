---
name: software-design
description: Evidence-backed design guidance distilled from 14 supplied software books. Use for consequential architecture or coupling decisions, risky legacy refactors, test-boundary choices, domain modelling, shared-state concurrency, security-sensitive changes, or production failure handling. Select only the relevant reference section; ordinary local edits use the role-appropriate checks already embedded in Plan, Audit, Implement, and Review.
---

# Software design

Use the role-appropriate design checks in the agent prompt as the default. Plan and Audit receive the full compact synthesis; Implement receives code-level checks inside the settled design, and Review receives diagnostic checks rather than an architectural design process. This skill supplies conditional detail and source anchors. It does not authorise edits, experiments, network calls, or broader scope: preserve the brief, repository conventions, role permissions, review budget, and required output format. In read-only roles, inspect references and reason only; do not run a recipe that would write files or change state.

## Select the relevant reference

Read the appropriate section below when its decision arises. Resolve filenames relative to this skill directory. Do not load the whole library or require every pattern in every contribution.

| Trigger | Read | Questions it answers |
|---|---|---|
| Unclear requirements, abstraction quality, interface contracts, naming, comments, algorithm choices | `foundations.md` | What must hold, what should callers know, and which complexity can one owner hide? |
| Legacy code, behaviour preservation, test seams, mocks, refactoring or interface migration | `safe-change.md` | What might change unintentionally, and where can tests observe it? |
| Architecture characteristics, coupling, reuse, service boundaries, data ownership, distributed workflows | `architecture.md` | What knowledge changes together, at what distance, and with what failure/consistency costs? |
| Domain rules, value types, aggregates, functional boundaries, immutability, ordering or messaging | `modelling.md` | Which invariants, effects, aliases, and histories determine correctness? |
| Untrusted inputs, authorisation, sensitive values, resource limits, retries, overload or partial failure | `production.md` | Which states and failures must be prevented or contained? |

If more than one topic applies, start with the highest-consequence uncertainty and read another section only when needed. If a reference is unavailable, continue with the embedded rubric, disclose any material gap, and never invent an attribution. Review may read a directly relevant section within its existing budget; this is not permission to audit the ecosystem.

## Apply the evidence

1. Identify the intended behaviour, constraints, and unknowns that could change the decision.
2. Select a recommendation only if its preconditions fit. State its cost and the guarantee it does not provide.
3. Prefer a proportionate change and a check capable of detecting the threatened failure. Escalate broader redesign needs rather than silently implementing them.
4. Report the concrete decision or consequence in the role's existing format. Do not recite a book checklist or manufacture a finding.

`synthesis.md` records source coverage, disagreements, and how the guidance was selected. `sources.json` identifies the supplied files and text-processing counts. `evaluation.md` contains synthetic acceptance cases; it is for evaluating these instructions, not additional ceremony for ordinary coding tasks.
