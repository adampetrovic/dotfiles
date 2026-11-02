# Design-instruction evaluation cases

Use these cases to check whether the instructions lead to proportionate decisions. They are synthetic acceptance criteria, not claims that agent behaviour has been validated. The structural test in `tests/software-design.test.mjs` checks rendering and packaging only.

For a model-based check, give the candidate agent its rendered prompt and the case facts. Ask for the decision, evidence, next step, and rejected unnecessary work. Use an isolated fixture if exercising tools; never let a scenario authorise changes to a real project. Record the model, prompt revision, case results, and limitations. A response can satisfy these cases without demonstrating better performance on real repositories.

## E1: A small local bug

A formatter uses `value || "unknown"`, incorrectly replacing the valid value `0`. The documented contract accepts zero; existing tests cover only positive numbers and absence. The settled brief allows changes to this formatter and its tests.

Expected: add a regression test for zero and appropriate absence cases; make a small contract-preserving fix; run the relevant tests. Do not introduce a formatter framework, domain layer, interface hierarchy, or alternative architecture exercise.

## E2: An ambiguous remote side effect

A payment request times out after transmission. The caller cannot tell whether the provider charged the account. A proposed patch retries three times. There is no documented provider idempotency guarantee.

Expected: identify duplicate-charge risk and distinguish timeout from confirmed failure. Verify the provider contract or use a supported idempotency/reconciliation mechanism before replay. Bound waiting and retries, but do not claim that a finite retry count makes replay safe. Review should flag the unsafe retry with its concrete consequence.

## E3: A legacy change without tests

A 700-line pricing function mixes calculations, database reads, and notifications. One discount rule must change. Callers depend on undocumented behaviour, and no automated tests exist.

Expected: identify the relevant change points, introduce the smallest useful seam, and characterise affected observable behaviour before structural changes. Separate intentional rule changes from behaviour-preserving refactoring. Do not rewrite the whole pricing system, discard existing behaviour as ugly, or block all work until a complete test suite exists. Characterisation records current behaviour; it does not prove that behaviour is correct.

## E4: Similar code with different ownership

Two independently deployed services have six identical lines formatting identifiers. Different teams own the formats and expect their rules to diverge. A shared library would require coordinated releases.

Expected: assess semantic ownership and change coupling. Small duplication may be cheaper than a shared release dependency. Do not apply DRY mechanically or insist that independently changing concepts share an abstraction.

## E5: Cross-context consistency

An order database commits successfully, then publishing its event fails. The design requires eventual delivery to billing and tolerates a delay. A proposal uses a local database transaction and claims that it also makes the remote publish atomic.

Expected: identify the gap between local and distributed atomicity. Consider an outbox or an equivalent supported delivery mechanism, duplicate handling, recovery, and observable lag. Do not promise exactly-once processing from retries or infer that separate services share a transaction. Plan should specify a test or fault scenario for the failure window.

## E6: A security-sensitive invariant

A tenant-scoped quota is checked using a validated immutable request object. Consumption happens later using an update that does not include the tenant or enforce the quota atomically. Concurrent requests can both pass the earlier check.

Expected: distinguish value validity from authorisation and temporal consistency. Enforce tenant ownership and the shared invariant at the state-changing boundary using suitable atomic operations. Do not assume a domain primitive or immutable request eliminates races or access-control requirements.

## E7: Tests coupled to implementation

A private helper is inlined without changing public behaviour. A test that asserts the helper was called fails; a test for a supported external notification also fails because the notification was accidentally removed.

Expected: distinguish the brittle internal assertion from the lost external contract. Replace or revise the first test toward observable behaviour; restore and verify the notification. Do not delete all interaction tests or mock every internal call.

## E8: An unmeasured optimisation

A small collection is sorted during a request. No latency requirement is being missed and no profile is available. A patch adds a global cache with invalidation hooks and mutable shared state solely because sorting might be slow.

Expected: prefer the simple implementation unless evidence or an established requirement justifies the cache. If performance investigation is needed, define representative input, baseline, and measurement. Review should explain the added invalidation and concurrency costs, not invent a bottleneck or demand benchmarks for every ordinary edit.

## E9: Simplifying errors

A repository method currently reports permission failure distinctly from missing data. A proposal catches all exceptions and returns an empty collection, arguing that it defines errors out of existence.

Expected: reject the loss of failure semantics and visibility. An empty result can represent genuinely absent data only if that is the documented contract. Preserve meaningful permission and operational failures and handle them at a responsible boundary. Do not make the interface deceptively simple by reporting success after failure.

## E10: A clean, bounded contribution

A patch adds a named domain value, updates its two consumers, and covers valid and invalid values. Existing style, compatibility, and ownership rules are followed. There is no evidence of caller burden, security failure, or unnecessary scope.

Expected: Review may approve with no findings. It must not invent issues because an alternative-design essay, a named pattern, a separate service, or a mock-based test is absent. Preserve the role's verdict and annotation format.

## Recording a run

For each case record `pass`, `partial`, or `fail`, with the actual decision and any omitted safety condition. A pass requires both the expected action and restraint against the stated unnecessary or unsafe action. Count unsupported assumptions, scope expansion, and invented findings as failures even when the response repeats the rubric's vocabulary. Do not claim these cases measure long-term maintenance cost, real defect rates, or all possible project contexts.

## Recorded smoke run: 2 November 2026, Australia/Sydney

The updated personal-profile agents were spawned after targeted chezmoi deployment. This was one open-book run per role, with the case descriptions and expected outcomes available to the agents. The parent assessed the returned reasoning against the criteria; agent self-assessments were not treated as proof. There was no old-prompt baseline, blinded assessment, repeated sampling, or real-project outcome measurement.

| Cases | Role and configured model | Parent assessment and observed reasoning |
|---|---|---|
| E1 | Plan, `openai-codex/gpt-6-astra` | Pass: proposed a focused regression and small fix; checked absence semantics before selecting an expression; rejected architecture work. |
| E3 | Plan, same model | Pass: bounded seam and characterisation before changing the rule; distinguished observations from requirements and integration gaps. |
| E4 | Plan, same model | Pass: retained independently owned formatting rather than adding a coordinated shared release. |
| E5 | Plan, same model | Pass: distinguished local commit from remote publication; considered an outbox or equivalent, duplicate-safe billing, recovery windows, and lag without inventing a target. |
| E8 | Plan, same model | Pass: rejected unsupported cache complexity and required evidence only if optimisation became justified. |
| E2 | Review, `openai-codex/gpt-6-astra` | Pass: flagged duplicate-charge risk and required verified idempotency or reconciliation before replay; did not infer provider behaviour. |
| E6 | Review, same model | Pass: required tenant ownership and atomic current-state enforcement; did not claim an exploit had been demonstrated. |
| E7 | Review, same model | Pass: separated private-helper brittleness from the genuinely lost notification contract. |
| E9 | Review, same model | Pass: rejected empty-success masking while preserving the possibility of legitimate absence semantics. |
| E10 | Review, same model | Pass: approved the bounded clean case with no invented finding or pattern requirement. |
| E1, executable fixture | Implement, `openai-codex/gpt-6.1-sol` | Pass: added zero/false/empty-string regressions, observed the zero assertion fail, changed only `||` to `??`, and passed all six fixture assertions. The parent inspected both files, checked the recorded failure, and reran the test. |

Planning/review cases tested written decisions, not real-code defect detection or execution. Review used general-scope annotations rather than inventing file/line anchors. Its normal UI handoff text was retained as part of the evaluated response, but no UI was opened for synthetic findings. The implementation fixture was isolated from the repository and configuration; no VCS, install, provider, load, deployment, or production operation was authorised.

SHA-256 of the deployed agent definitions used in this run:

- Plan: `4d94b1fae8d28f16a4d07405ad6fd75eba527248ccc678c481e00412299ded8b`
- Review: `c3e46cffa9b0fc28869f791785339dbc40f6e95294a6a0f8bb1c96775814e339`
- Implement: `8e5ef8518ad13a979e202a39995c7fda811b2aac3e9983d51d2162e110768a39`

These hashes identify the rendered agent definitions, including the inline rubric; they do not hash the entire inherited parent context or reference library. The pass results establish this limited smoke check only. After this run, rubric point 6 was clarified to require checking the scope of coordination mechanisms rather than making a blanket statement about cross-process guarantees; database transactions can coordinate participating writers without covering unrelated remote effects. The subsequent merge with concurrent main also preserved its role separation: full synthesis for Plan/Audit, code-level guidance for Implement, and diagnostic checks for Review. The hashes above identify the pre-merge smoke-tested definitions, not the final merged prompts. The final merged retest is recorded below. Work-profile agents received structural rendering checks, not model-based evaluation.

## Final merged-prompt retest

After deployment of the resolved merge, fresh personal-profile agents repeated the following open-book checks. Models were unchanged. The parent read the complete returned results and assessed them against the same criteria.

| Role | Cases | Parent assessment |
|---|---|---|
| Plan | E1, E5 | Pass: retained the small formatter fix, preserved Design/Chosen/Rejected/Interfaces without inventing executable signatures, and made outbox or supported change-capture delivery conditional on verified transaction, replay, ownership, and recovery guarantees. |
| Review | E2, E6, E7, E9, E10 | Pass: reported all four concrete correctness/security defects without misapplying the three-design-findings cap, approved E10 without invented issues, and used general annotations rather than fabricated paths. |
| Implement | E1 executable fixture | Pass: after resetting the scratch fixture to its original bug and incomplete tests, added the three falsy-value regressions, observed failure before the minimal fix, and passed all six assertions. The parent inspected the files and recorded failure, then reran the test successfully. |

Rendered definition SHA-256 for this retest:

- Plan: `a083666daedbd7cf7896986a5ec4613c00f2fd13b195cb58080ad7e8c20dafa9`
- Review: `7e31d713d58d308f339552f369f398774f705fa5d1c536244ff04862fa3b15f9`
- Implement: `edca6d27c2c80a4e45ee916e849475c1e7bd71b341819cec0b5dc3bf7c0d766b`

Audit received rendering and contract-preservation checks only, not a model-based audit case. E3, E4, and E8 were not repeated after the merge. The same limits apply: these were open-book synthetic checks, not blinded defect detection or evidence of improved real-project outcomes. No synthetic annotations were posted and no production action was taken.
