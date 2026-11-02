# Contracts, domain models, effects, and time

Sources: [05] *Good Code, Bad Code*, [10] *Learning Domain-Driven Design*, and [11] *Grokking Simplicity*. IDs identify supplied EPUBs in `sources.json`.

## Make misuse paths visible

Count preconditions, promised outcomes, invariants, call order, error cases, and state ownership as part of an interface. Prefer construction that produces a usable object over mandatory setup sequences with invalid intermediate states. Types, constructors, and runtime checks can prevent specific misuse paths; none eliminates the need to validate untrusted input. Do not introduce a builder or factory unless it removes a real burden. [05, ch. 3 “Code contracts,” “Checks and assertions.”]

Use representations that distinguish meaningful concepts: units, coordinates, instants, durations, and calendar dates. Keep primary data authoritative and derive redundant values where practical. Caches and denormalised state require an explicit consistency owner. Value objects can bundle validation, value equality, and operations, but a valid value does not establish access rights or the current validity of shared state. [05, ch. 7; 10, ch. 6. The access-right and shared-state distinction is a safety constraint in this synthesis.]

Choose error signals according to who can recover and what they need to know. Translate infrastructure failures into the caller's abstraction without discarding their cause. Absence can legitimately produce an empty collection; permission failure or an unsuccessful mandatory operation must not silently become an empty success. Fail near a programming defect, but distinguish rejecting one request from terminating the service. [05, ch. 4; chs. 6, 8.]

## Separate decisions from effects

Identify actions whose meaning depends on when or how often they run, calculations with explicit inputs and stable outputs, and inert data. Clock reads and shared-state reads are actions even without writes. Extract decisions into calculations where that removes setup and hidden dependencies; keep necessary effects in a smaller orchestration boundary. Make remaining implicit inputs and outputs explicit. [11, chs. 3–5.]

Do not add logging inside a reusable calculation when that would record hypothetical evaluations as actual business actions. Fresh local mutation that never escapes can remain externally pure. Higher-order functions and pipelines can reduce repeated traversal logic, but generic callbacks and field names create contract and discoverability costs. Prefer domain-facing operations when callers would otherwise need representation knowledge. [11, chs. 9–14; 05, chs. 7–9.]

Within copy-on-write cooperation, copy the changed path and share immutable branches. A shallow copy does not protect nested mutable data. At boundaries with code that may mutate or retain aliases, protect incoming and outgoing data appropriately. Read-only fields are not deep immutability. Deep copying has cost and may not preserve arbitrary object semantics; prefer suitable ownership mechanisms, persistent structures, or established libraries over copying teaching implementations into production. [11, chs. 6–7, 12; 05, ch. 7.]

## Scope domain modelling to the problem

Use strategic design to clarify business goals, language, and ownership before choosing tactical patterns. Straightforward CRUD or ETL can suit transaction scripts or active records. Rich models should earn their cost through complex rules and invariants; core business value, volatility, and buying-versus-building choices inform where effort belongs. Complexity alone is not business value. [10, chs. 1–2, 5, 10, appendix A.]

Keep contextual meanings local. The same business noun can represent different concepts in different bounded contexts. Translate between models where needed rather than forcing an enterprise-wide record onto every consumer. A shared kernel is deliberate coupling with coordination costs. Subdomains describe business structure; bounded contexts are designed model boundaries. Neither implies one service per context or one context per aggregate. [10, chs. 2–4, 14.]

Let invariants determine transaction boundaries. An aggregate root controls changes to the smallest coherent state that must remain strongly consistent. Reference independent aggregates by identity when eventual consistency is acceptable. Use appropriate version checks or atomic operations to prevent stale decisions overwriting concurrent updates. A coordinating service does not make separate transactions atomic; an oversized aggregate adds contention. [10, chs. 6, 10–11.]

## Model partial failure and histories

A local database transaction does not atomically cover an unrelated message broker or file store. Publishing before commit and publishing after commit each leave failure windows. An outbox can atomically record state and message intent, but its relay can deliver duplicates. Review consumer idempotency, recovery, and observable lag. [10, chs. 5, 9, 15.]

A lost response after a successful write can make retries repeat an operation. Sagas and process managers coordinate eventual workflows; compensation is another business action that can fail, not proof the first action never occurred. If the invariant requires true atomicity, reconsider the boundary rather than renaming compensation a transaction. [10, chs. 9, 15.]

Distinguish events reporting facts from commands requesting rejectable work. Event sourcing makes transitions the authoritative history and adds schema evolution, deletion, replay, and operational costs. CQRS, event sourcing, and event-driven integration solve different problems and need not come together. Do not expose internal history as a public integration contract by default. [10, chs. 7–8, 15.]

## Review ordering explicitly

Draw timelines for risky effects: shared resources, reads and writes, asynchronous boundaries, and required order. Single-threaded execution does not prevent an older response overwriting newer state after an asynchronous operation. Passing snapshots removes some shared reads but does not order remaining effects. Reduce sharing before adding coordination. [11, chs. 15–17.]

Queues serialise only work routed through them; joins wait for specified prerequisites; dropping queues are valid only when obsolete work may be discarded. Define cancellation and failure release, not merely success callbacks. Fixed delays do not establish causal completion. A process-local once-only flag does not establish durable exactly-once effects across crashes or distributed retries. [11, chs. 16–17; 10, chs. 9, 15. The cross-process distinction combines both sources.]

## Check the actual contract

Test outcomes, boundaries, failures, and supported effects without inventing requirements such as undocumented collection ordering. A fake or mock can pass while misrepresenting the real dependency; retain integration evidence where that contract matters. Passing tests do not prove all interleavings safe. Combine tests with state and timeline reasoning. [05, chs. 10–11; 10, ch. 10; 11, chs. 15–17.]

Functional transition calculations and encapsulated aggregate commands can both protect domain rules. Choose according to ownership, mutation, persistence, and caller burden. Do not require one programming style or a rich-domain-model template everywhere. [11, chs. 4–7, 18; 10, ch. 6.]
