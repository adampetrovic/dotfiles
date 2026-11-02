### Names, consistency, and obviousness (chapters 14, 17, 18)

- Choose precise, intuitive names that convey the concept's scope and distinguish it from nearby concepts. Use predicates for booleans, meaningful sentinel names, and consistent role distinctions. Avoid vague names and names tied to one special use of a general mechanism. Short local loop names are fine when their meaning is evident; wider scope needs more information.
- If nothing precise fits, or a contract is hard to describe simply and completely, treat that as evidence the abstraction is wrong, not as a wording problem.
- Follow local naming, interface, formatting, and design conventions and preserve invariants. Use automated checks where appropriate. Do not impose one pattern on semantically different things or change conventions without sufficient benefit and authorization to migrate existing uses.
- Judge obviousness from a new reader's perspective. Prefer meaningful structures/fields over anonymous pairs, readable layout, and explicit control/data flow. Document callback invocation conditions and context, surprising side effects, and concrete-type properties callers rely on. Reader confusion is evidence to investigate, not something to dismiss because the author understands the code.

### Comments (chapters 12, 13, 15)

- Write an interface comment for each new or changed interface that other modules call. It should let a caller use the interface without reading the implementation: behaviour, parameters, results, side effects, errors, remaining preconditions, and any required order or pairing with other calls. Leave implementation mechanics out unless callers depend on them, such as observable concurrency, persistence, or performance guarantees.
- Inside an implementation, comment only what the code cannot say: why this approach, a non-obvious constraint or invariant, units, bounds, ownership, lifecycle, the meaning of absence, or the bug a subtle line prevents.
- Otherwise match the comment density and doc conventions of the surrounding file. Do not narrate statements, restate names or types, or add doc blocks that carry no information.
- When a change creates an obligation to update code elsewhere in step, such as a format shared by a writer and a reader, state it once in the authoritative place and point to it from the other.
- Update or delete comments the change makes stale, and check the diff for stale docs, debug leftovers, and unresolved TODOs.

### Errors and special cases (chapter 10)

- Design harmless boundary cases into normal semantics where the contract permits: idempotent removal or an empty range can remove repeated branches. Preserve meaningful validation, security checks, and failure signals; defining a case as valid requires deliberate, correct semantics.
- Handle recoverable failures inside the responsible module when it can recover reliably and callers need not know. Preserve errors callers need for correctness. Never translate an unknown failure into success, silently discard data, or add unlimited retries merely to simplify an interface.
- Aggregate failures with the same recovery at a shared boundary instead of duplicating handlers. Retain useful diagnostics, cleanup, and state invariants. Distinguish request-local failure from system failure. Promoting rare failures to an existing recovery path can simplify code, but assess the recovery cost and availability requirements.
- Fail fast with clear diagnostics for genuinely unrecoverable internal failures only when the application's safety and availability contract allows it. A service or replicated store may require recovery instead. Choose error policy deliberately; do not adopt crashing as a universal shortcut.

### Tests and performance (chapters 19–20)

- Tests support safe change; use unit and integration/system tests for their respective contracts. Coverage does not prove correctness. For bug fixes, reproduce the bug in a regression test before fixing it when feasible. Follow the repository's required testing workflow.
- Choose naturally efficient code when it is equally clear. Be aware of network/storage I/O, allocation, cache locality, and redundant layer crossings without guessing at universal costs. Use microbenchmarks to learn operation costs when relevant; avoid both premature optimization and widespread avoidable inefficiency.
- Measure before performance-driven changes: identify specific bottlenecks, establish a baseline, and remeasure. Prefer algorithmic/data-structure improvements or appropriate caching over intricate local tweaks. Retain added complexity only for demonstrated benefit or an already-established performance requirement; remove ineffective optimizations unless they simplify the code.
