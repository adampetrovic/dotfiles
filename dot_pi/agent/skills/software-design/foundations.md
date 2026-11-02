# Foundations: problem framing, abstraction, and reasoning

Sources: [01] *Programming Pearls*, [03] *The Pragmatic Programmer*, and [14] *A Philosophy of Software Design*. IDs identify the supplied files in `sources.json`. These are paraphrased decision aids, not rules the authors wrote for agents. Chapter, column, and topic names below are source anchors.

## Frame the problem before selecting a representation

Identify the desired outcome, constraints, input distributions, existing contracts, and assumptions that could change the solution. Bentley's bitmap sorting solution depends on a bounded integer domain and its treatment of duplicates; it does not establish that specialised representations always beat general libraries. Use rough estimates to rule out infeasible approaches, then verify consequential assumptions. Distinguish user needs from policies and proposed implementations. [01, columns 1 “Cracking the Oyster,” 7 “The Back of the Envelope,” 12 “A Sample Problem”; 03, topic 45 “The Requirements Pit.”]

Compare materially different approaches for consequential uncertainty: interfaces, representations, decomposition, or algorithms. Compare caller work and implementation cost as well as speed. A disposable prototype answers a question and may omit unrelated production concerns; a tracer intended to become production code needs production contracts. Keep experiments bounded and label their limits. [14, ch. 11 “Design it Twice”; 03, topics 12–13 “Tracer Bullets,” “Prototypes and Post-it Notes.”]

## Assess whole-system complexity

Look for change amplification, cognitive load, and unknown update obligations. Count informal sequencing, exceptions, configuration, and cleanup as interface costs. Weight complexity by how often readers and callers encounter it. Small compromises accumulate; working code alone does not establish maintainability. Improve the affected design continuously without using design debt as permission to expand the brief. [14, chs. 1–3, 16, 21; 03, topics 27 “Don't Outrun Your Headlights,” 40 “Refactoring.”]

Prefer deep modules: useful capability behind a small but complete interface. Make common operations simple, use sensible or computed defaults, and avoid forcing ordinary callers to learn rare options. Expose settings when callers possess useful knowledge the module cannot infer. An abstraction must not hide persistence, concurrency, failure, or performance properties callers need for correct use. [14, chs. 4 “Modules Should Be Deep,” 8 “Pull Complexity Downwards.”]

Own knowledge, not merely fields. Private data with representation-exposing accessors still leaks design decisions. Organise around shared formats and assumptions rather than execution stages. Give each layer a distinct abstraction. Question forwarding wrappers, pass-through variables, and layers that add no contract; retain them when they provide a real boundary. Context objects can reduce plumbing but can also conceal dependencies or introduce shared-state races. [14, chs. 5–7.]

Pull complexity into the module responsible for it when callers become simpler. Keep unrelated application policy out of lower-level mechanisms. Aim for somewhat general interfaces serving present needs, not speculative frameworks. Combine code that shares knowledge or cannot be understood independently; separate independently meaningful concepts. Extract substantial repetition when the interface improves. Similar text can represent independently changing rules, so DRY concerns repeated knowledge rather than mere visual similarity. [14, chs. 6, 8–9; 03, topic 9 “DRY—The Evils of Duplication.”]

Do not split methods solely to satisfy a line limit. A helper should be understandable without continual navigation back to its caller; paired caller-visible operations that shuttle state may be a worse interface. A long coherent operation can be clearer than many conjoined helpers. Inheritance, decorators, and design patterns must earn their coupling and interface cost; consider composition and direct code. [14, chs. 7, 9, 19.]

## Make behaviour understandable

Draft the abstraction and important interface comments before bodies, then revise them with the code. Difficulty choosing a precise name or writing a short, complete contract is a reason to reconsider the concept. Comments complete abstractions with information declarations cannot express: units, bounds, absence semantics, ownership, invariants, side effects, errors, and remaining preconditions. Minimise preconditions instead of merely documenting them. [14, chs. 12–15; 03, topics 23 “Design by Contract,” 44 “Naming Things.”]

Keep caller contracts separate from implementation rationale. Explain strategy and nonobvious reasons rather than narrating statements. Put durable rationale near the relevant code and cross-module obligations in one discoverable place with references. Update documentation with code; lack of time, self-documenting-code claims, bad comments, and fear of stale comments do not justify omitting needed information. [14, chs. 12–16.]

Use precise names, meaningful fields rather than anonymous pairs, readable layout, and consistent terminology. Short local loop names can be adequate; wider scope needs more meaning. Follow local conventions and invariants without forcing dissimilar things into one pattern. Document callback invocation conditions, surprising side effects, and concrete-type properties that affect callers. Investigate reader confusion rather than defending author familiarity. [14, chs. 14, 17–18.]

## Reason about correctness and failure

State consequential invariants and check initialization, preservation, progress, termination, and boundaries. A plausible proof may still omit overflow, aliasing, or invalid access. Combine reasoning with examples, generated properties, and integration checks; preserve useful generated counterexamples as regressions. Passing examples and coverage cannot establish every relevant state. [01, columns 4 “Writing Correct Programs,” 5 “A Small Matter of Programming,” 14 “Heaps”; 03, topics 41–42.]

Define harmless cases into normal semantics when the contract allows, such as idempotent removal or an empty range. Recover internally only when recovery is reliable and callers need no further information. Aggregate errors with the same recovery at a responsible boundary. Preserve security checks, meaningful failure signals, diagnostics, cleanup, and state integrity. Error promotion and process termination require explicit recovery-cost, safety, and availability reasoning. Neither catching everything nor crashing on every failure is a universal simplification. [14, ch. 10 “Define Errors Out Of Existence”; 03, topics 23–26.]

Treat files, working directories, databases, and external resources as shared state too. Assign resource acquisition, ownership, release, and partial-failure cleanup explicitly. Locks require every accessor to participate; atomic operations or appropriate transactions can reduce caller obligations. Actors and asynchronous designs add tracing and operational costs despite isolating some state. [03, topics 26, 33–36.]

## Use performance evidence

Choose naturally efficient designs when equally clear. Before accepting optimisation complexity, establish a representative baseline and locate the bottleneck. Account for input distribution, worst cases, locality, allocation, I/O, and compiler effects. Historical timings are not present-day guarantees. Prefer algorithmic or representation improvements before low-level tuning. For a measured critical path, sketch the minimum common-case work, then restore clean boundaries and move exceptional work aside where semantics permit. Remeasure other important paths too. [01, columns 5–15 and selected solutions; 14, ch. 20; 03, topic 39.]

## Preserve disagreements

Ousterhout criticises feature-by-feature TDD as a design strategy while endorsing testing and bug regressions. Other sources use test-first feedback to shape APIs. Follow the project's workflow and assess abstraction coherence separately. Likewise, transformation pipelines help when stages are meaningful and independent, but hurt when stages duplicate representation knowledge. Neither school supplies an unconditional decomposition rule. [14, chs. 5, 19; 03, topics 30, 41; 01, column 2.]

## Red flags to investigate

Shallow modules; information leakage; temporal decomposition; overexposure; pass-through methods or variables; repetition; mixed special/general code; conjoined methods; comments repeating code; implementation details contaminating interface documentation; vague or hard-to-pick names; hard-to-describe contracts; nonobvious code. Each needs a concrete consequence before it becomes a review finding. [14, “Summary of Red Flags.”]
