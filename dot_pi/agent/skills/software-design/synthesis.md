# Software-design instruction synthesis

## Scope and method

This synthesis uses the 14 EPUBs in the supplied `books.zip`, identified individually by SHA-256 in `sources.json`. It does not claim to cover the earlier 100-book bibliography. In particular, the archive does not contain *Designing Data-Intensive Applications*, *A Philosophy of Software Testing*, or the Gang of Four *Design Patterns*.

The archive was read outside the repository. EPUB package spine order was used to extract HTML text, headings, and available image alt text. Five research agents assigned complete files to reading workers, one chunk per call, and produced chapter-anchored notes. Across the assignments, all 86 chunks were processed: 1,512,529 extracted words across 786 spine items, including front/back matter, indexes, exercises, and advertisements where supplied. The final instructions were synthesised from those notes; the parent did not independently reread every word.

These counts establish coverage of the extracted text, not every original visual. Diagrams and image-only code without usable text were not independently inspected. Some examples have abbreviated or damaged extraction; no recommendation depends on an unreadable listing or figure. Historical timings, product recommendations, and security mechanisms were not validated as current external contracts. The books provide practitioner arguments and examples, not controlled evidence that these instructions improve coding-agent outcomes.

Raw books, extracted text, personal watermark metadata, and copied code are not included here. The references contain original paraphrases, chapter anchors, and explicit qualifications. The extracted corpus and working research notes remain local temporary material and are not required at runtime. Hashes identify the exact supplied inputs if source verification is needed later.

## Supplied books and contributions

| ID | Book and supplied edition caveat | Processed chunks | Contribution and principal anchors |
|---|---|---:|---|
| 01 | *Programming Pearls*, Jon Bentley; filename year is not an edition claim | 5/5 | Constraint-driven representations, invariants, estimates, measurement, workload sensitivity. Columns 1–15 and selected solutions. |
| 02 | *Release It!*, Michael T. Nygard, second edition | 7/7 | Failure propagation, capacity, containment, deployment, production learning. Chapters 2–6, 13–17. |
| 03 | *The Pragmatic Programmer*, Andrew Hunt and David Thomas, twentieth-anniversary second edition | 5/5 | Requirements, knowledge ownership, feedback, contracts, resource ownership, tests. Topics 9, 12–13, 23–27, 33–45, 51. |
| 04 | *Refactoring*, Martin Fowler, second edition | 7/7 | Behaviour-preserving transformations, reversible structural choices, API migration. Chapters 1–4 and catalogue chapters 6–12. |
| 05 | *Good Code, Bad Code*, Tom Long | 8/8 | Complete contracts, error semantics, misuse prevention, types, useful tests. Chapters 3–11. |
| 06 | *Working Effectively with Legacy Code*, Michael Feathers | 7/7 | Seams, characterisation, effect analysis, bounded entry into testing. Chapters 2–4, 6, 11–13, 23–25. |
| 07 | *Fundamentals of Software Architecture*, Mark Richards and Neal Ford, second edition, 2025 | 8/8 | Quality scenarios, architecture styles, modular monoliths, fitness checks, decision records. Chapters 4–7, 11, 14–22, 25–27. |
| 08 | *Software Architecture: The Hard Parts*, Neal Ford, Mark Richards, Pramod Sadalage, Zhamak Dehghani, first edition | 7/7 | Decomposition/reintegration, reuse, data ownership, distributed workflows, trade-offs. Chapters 1–15. |
| 09 | *Balancing Coupling in Software Design*, Vlad Khononov; filename says 2024, copyright frontmatter 2025 | 4/4 | Integration strength, distance, volatility, essential coupling. Chapters 5–11, 13. |
| 10 | *Learning Domain-Driven Design*, Vlad Khononov | 5/5 | Strategic modelling, bounded contexts, aggregates, implementation choices, messaging. Chapters 1–11, 14–15. |
| 11 | *Grokking Simplicity*, Eric Normand | 7/7 | Actions/calculations/data, immutable cooperation, abstraction, timelines. Chapters 3–18. |
| 12 | *Secure by Design*, Dan Bergh Johnsson, Daniel Deogun, Daniel Sawano | 8/8 | Domain primitives, state integrity, semantic boundaries, validation, sensitive paths. Chapters 2–14. |
| 13 | *Unit Testing: Principles, Practices, and Patterns*, Vladimir Khorikov, **MEAP Version 3** | 5/5 | Test value, observable contracts, doubles, integration boundaries. Supplied chapters 1–11; not assumed to match final publication. |
| 14 | *A Philosophy of Software Design*, John Ousterhout, first edition, 2018 | 3/3 | Complexity, deep modules, information hiding, documentation, diagnostic red flags. Chapters 1–21 and summaries. |

## Selection and placement

Role-appropriate guidance is expanded inline so its baseline does not depend on optional skill discovery. Plan and Audit receive the full compact synthesis. Implement retains the code-level APOSD rubric and gains a multi-source implementation supplement, without architectural option selection. Review retains the APOSD red flags and gains a multi-source diagnostic supplement; the existing cap of three design findings applies across both. Source attribution and conditional detail live in this shared skill, available in both profiles. Explore remains read-only search; the retired general-purpose agent stays disabled.

Concurrent main changes added Audit, interface-sketch contracts, turn limits, role-specific APOSD partials, and an APOSD-only external review skill. The merge preserves those operational contracts. The original APOSD rubric is retained in `aposd-design.md` with its original nested partials, and the APOSD-only skill points there; its complete rendered output is byte-identical to an independently captured parent baseline. The multi-book synthesis does not silently change that specialised review's attribution.

Recommendations were selected for an identifiable problem, a usable decision test, explicit costs, and a safe scope. Recurrence across books supports inclusion but is not a vote that overrides better reasoning or a counterexample. A distinctive argument can be worth retaining even when only one book supplies it. The cross-source resolutions below are this synthesis, not assertions that the authors agree.

| Embedded rubric point | Main source support | Detail |
|---|---|---|
| 1: frame the change | 01 columns 1, 7, 12; 03 topic 45; 04 ch. 2; 06 ch. 1 | `foundations.md`, `safe-change.md` |
| 2: compare consequential options | 14 ch. 11; 03 topics 12–13; 07 ch. 19; 08 ch. 15 | `foundations.md`, `architecture.md` |
| 3: total complexity and interfaces | 14 chs. 2, 4–9; 05 ch. 3 | `foundations.md`, `modelling.md` |
| 4: knowledge, ownership, coupling | 03 topic 9; 09 chs. 7–11; 08 ch. 8 | `architecture.md` |
| 5: contracts and valid states | 14 chs. 12–18; 05 chs. 3, 7; 12 chs. 5–7 | `foundations.md`, `modelling.md`, `production.md` |
| 6: effects and state | 11 chs. 3–7, 15–17; 10 chs. 6, 9; 03 topics 26, 33–36 | `modelling.md` |
| 7: meaningful failures | 14 ch. 10; 05 ch. 4; 02 ch. 5 | `foundations.md`, `production.md` |
| 8: safe changes | 04 chs. 1–4, 6–12; 06 chs. 2–4, 11–13, 25 | `safe-change.md` |
| 9: useful test guarantees | 13 chs. 1–11; 05 chs. 10–11; 03 topic 42 | `safe-change.md`, `modelling.md` |
| 10: trust and capacity | 12 chs. 4–5, 8–10; 02 chs. 4–5; 03 topic 43 | `production.md` |
| 11: measurement and operations | 01 columns 5–15; 14 ch. 20; 02 chs. 13–17 | `foundations.md`, `production.md` |
| 12: proportionate improvement | 14 chs. 3, 16; 03 topics 27, 40; 07 ch. 27 | All references; role boundaries are local agent policy. |

Role-specific additions ask Plan to identify invariants, measurable scenarios, alternatives, and safe sequencing; Audit to apply the synthesis to its existing bounded design audit; Implement to protect the permitted behaviour delta and stop at design conflicts; Review to trace concrete failure mechanisms and avoid speculative findings. Source books do not define these agent roles or their permission model.

## Disagreements and conditional resolutions

| Tension | Resolution for agents |
|---|---|
| Abstraction-first design versus test-first development | Ousterhout criticises feature-led TDD; Fowler and Feathers use test-first feedback. Follow the repository workflow, use regression-first bug fixes when feasible, and assess abstraction coherence separately. |
| Small functions versus deep coherent methods | Extraction and inlining are both tools. Require an independently meaningful boundary or reduced reader/caller burden; no fixed line-count doctrine. |
| DRY versus local duplication | Share one genuinely shared rule when that reduces total change cost. Keep independently owned policies separate; copied mandatory rules still require synchronised maintenance. |
| Legacy seams versus encapsulation and mock restraint | A bounded seam can obtain safety in difficult code without being the destination design. State what a double proves and retain the real integration gap. |
| Pure calculations versus encapsulated mutable domain objects | Both can enforce invariants. Choose according to ownership, aliases, persistence, effects, and caller work; do not impose one representation. |
| General interfaces versus specialised algorithms | A constrained internal representation can sit behind a usable interface. Avoid both speculative frameworks and repeated caller-specific methods. |
| Pipelines versus knowledge-centred boundaries | Split meaningful independent transformations; combine stages when separation duplicates format knowledge or ordering obligations. |
| Removing exceptions versus explicit failure contracts | Define harmless cases deliberately. Preserve failures needed for recovery, security, and truthful business results. Never infer success from unknown failure. |
| Loose coupling versus essential consistency | Transport cannot remove a business invariant. Keep atomic relationships close; adopt eventual consistency only when the business contract permits it. |
| Services versus modular monoliths | Distribution must earn latency, failure, operating, and migration costs. Modularity and deployment granularity are separate decisions. |
| Immutability versus concurrency safety | Snapshots and immutable values reduce some hazards but do not serialise remote effects or enforce database invariants. Analyse ordering and atomicity separately. |
| Fail-fast versus availability | Reject invalid or impossible work near its cause; choose request-local failure, isolation, or termination according to the safety and recovery contract. |

## Validation boundaries

`tests/software-design.test.mjs` checks both profile renderings for all four roles, models, prompt modes, limits, interface-sketch and output contracts, role-specific rubric placement, APOSD-only rendering equivalence, reference packaging, source-count consistency, and exclusion of book archives/text from the skill. It cannot prove source claims or model behaviour.

`evaluation.md` defines synthetic cases for proportionality, safe replay, legacy entry, duplication, distributed atomicity, authorisation/concurrency, test fragility, optimisation, truthful errors, and no-findings review. Record model-based results separately and retain failures. Neither structural checks nor a successful synthetic run establishes lower defect rates or better long-term maintenance on real projects.
