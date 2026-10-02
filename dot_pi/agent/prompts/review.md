---
description: Independently review a change for actionable defects
argument-hint: "[change or review focus]"
---
Review ${@:-the current change} independently. Read the diff, its intent and nearby code; follow repository review instructions. Prioritize correctness, security, data loss, concurrency, compatibility, and operational impact over style. Trace suspected issues to real execution paths and check existing tests or contracts before reporting them. Return only actionable findings, each with severity, precise file/line reference, evidence, and a plausible fix; distinguish confirmed defects from hypotheses. If nothing actionable is found, say so and name any verification gaps. Do not modify the change or post review comments unless asked.
