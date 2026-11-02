# Security, reliability, and production transitions

Sources: [02] *Release It!*, second edition, and [12] *Secure by Design*. IDs identify supplied EPUBs in `sources.json`. Historical product, cryptography, browser, and infrastructure advice has not been checked as current policy; verify current external contracts when a task depends on them.

## Protect business outcomes and finite capacity

Name the useful transaction and business invariant. An alive process, balanced ledger, successful component test, or open socket does not prove the intended transaction completes correctly. Semantic mistakes can make several technically consistent components agree on a false business outcome. [02, chs. 2–3, 6; 12, ch. 2.]

Inspect mechanisms that retain resources: dependency waits, connection checkout, locks, queues, result sets, caches, logs, and parser work. A stalled dependency can exhaust upstream capacity. Bound work where it originates; query limits protect the database better than abandoning a loop after fetching an enormous result. Define queue capacity and its full-queue policy. Choose limits from workload and end-to-end objectives, not universal constants. [02, chs. 4–5, “Blocked Threads,” “Slow Responses,” “Unbounded Result Sets,” “Timeouts,” “Steady State”; 12, section 9.3.]

Timeouts stop waiting, not necessarily remote work. Treat retries as additional load and possible duplicate business effects. Distinguish transient failure, permanent rejection, and ambiguous completion; establish repeatability or supported idempotency before replay. Use bounded budgets, backoff, and spreading where justified. Deferred retries require business acceptance of delayed completion. Never infer safety merely from a small retry count. [02, “Dogpile,” “Timeouts”; 12, ch. 11.]

Give containment mechanisms distinct jobs. Circuit breakers suppress repeated failing calls and probe recovery; bulkheads isolate capacity; load shedding rejects work that cannot finish usefully; back pressure asks cooperating producers to slow down. A queue cannot absorb sustained overload indefinitely. Check hidden shared databases, hosts, routers, and pools before claiming isolation. A fallback must preserve an approved business meaning rather than inventing success. [02, ch. 5; 12, section 9.3.]

## Enforce meaning and state integrity

Distinguish stable entity identity from value equality, with scope explicit. Domain primitives can prevent swapped arguments and encode validation, but not every scalar needs a wrapper. Similar names across contexts may mean different things: a transfer request is not evidence that money was received. Translate at semantic boundaries and identify the authoritative fact. [12, chs. 3, 5, 11, 13; 02, ch. 16 “Information Architecture.”]

Construct complete valid objects, keep unfinished products private, and preserve invariants through controlled domain operations. Mutable aliases, collection elements, unrestricted setters, and persistence reconstruction can bypass validation. An unmodifiable view does not freeze its backing data. If initialisation legitimately spans requests, model a lifecycle state rather than pretending a half-built object is ready. [12, chs. 3, 6.]

Choose lifecycle representations according to transitions and concurrency. Values can be immutable; explicit states can centralise transition rules; snapshots can help shared reads; phase-specific entities can suit mostly forward workflows. These are alternatives, not a required pattern stack. Immutable snapshots still require write coordination and do not prevent database races. Simple toggles do not justify elaborate state machinery. [12, chs. 4, 7.]

## Validate and handle sensitive data at boundaries

Check origin and size before expensive lexical, syntax, and semantic work where that sequence fits. Bound parser expansion and aggregate parallel consumption as well as raw input length. Avoid ad hoc deletion of suspicious characters that leaves unsafe transformed input; deliberate canonicalisation needs an explicit contract. [12, sections 4.3, 8.2, 9.4.]

Domain validation does not replace authorisation, parameterised queries, or context-specific output encoding. A legitimate domain string can still be unsafe in another rendering context. Apply least privilege and verify identity and ownership where state changes. These baseline security obligations combine the supplied books; they are not claims that a domain type alone establishes security. [12, sections 1.5, 9.4; 03, topic 43 “Stay Safe Out There.”]

Treat error and logging paths as interfaces. Distinguish domain outcomes from technical failures without parsing exception messages. Avoid sensitive payloads, raw rejected input, and indiscriminate whole-object logging; future fields can silently expand exposure. Log viewers can become injection targets. Use suitable correlation identifiers without leaking credentials or personal data. Protect log transport, access, integrity, retention, and outage handling. [12, chs. 5, 9–10, 12–13; 02, “Transparency.”]

Read-once secret objects can reduce accidental reuse or logging but cannot erase every runtime copy. Environment variables do not themselves provide secret storage. Follow the project's approved secret-management and cryptographic mechanisms; do not turn historical delivery examples into current defaults. [12, chs. 5, 10.]

## Design for mixed versions and recovery

During rollout, old and new code may operate on the same data. Establish meaningful readiness, bounded draining, compatible schema expansion, migration verification, and contraction only after old consumers are gone. Test production-shaped legacy data and cross-version access. Stricter validation can break existing clients even when correcting a defect; choose a deliberate migration strategy. [02, chs. 13–14; 12, section 12.2.]

Separate early validation, rejecting overloaded work, request-local failure, and process termination. “Let it crash” requires isolated failure units, supervision, bounded restart behaviour, fast replacement, and reintegration. Blind restarts or slow-start monoliths do not meet those assumptions. Early dependency checks cannot guarantee later success. Preserve cleanup, diagnostics, and state integrity. [02, ch. 5; 12, ch. 4.]

Test absent, delayed, reset, malformed, oversized, and semantically invalid dependency responses, not only documented errors. Verify configuration defaults and disabled behaviour as well as enabled paths. Security review and appropriate specialised testing remain necessary; domain design and automation do not prove security. [02, “Test Harnesses,” chs. 16–17; 12, chs. 8, 14.]

Fault injection, load tests, chaos experiments, deployment, and production actions require explicit permission. Define observable invariants, baseline health, blast radius, abort conditions, recovery, and cleanup. Automation needs governors and minimum-capacity safeguards. Do not convert advice about production learning into authority to disrupt a live system. [02, “Governor,” chs. 16–17; 12, section 14.5.]
