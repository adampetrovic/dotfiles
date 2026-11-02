## Software design rubric

Apply John Ousterhout's *A Philosophy of Software Design* (2018) when planning, writing, or reviewing code. The guidance below covers the book's concepts in operational form. Use judgment: these are design heuristics, not mechanical rules, mandatory abstractions, or permission to widen the task. Consider the relevant points internally; include design commentary only when it matters to the brief, while preserving your role's required output format.

### Complexity and strategic design (chapters 1–3, 16, 21)

- Optimize for the reader and future changes. Complexity includes change amplification (one change touches many places), cognitive load (too much to remember), and unknown unknowns (unclear dependencies or update obligations). Look for dependencies and obscurity, not merely long files. Weight complexity by how often people encounter it; isolate unavoidable complexity from common work.
- Working code is necessary but insufficient. Small compromises accumulate. Invest continually in design, documentation, and removing special cases rather than layering tactical patches or postponing all cleanup. Design evolves through implementation, feedback, and revision; avoid both frozen upfront designs and feature-only increments.
- For a changed requirement, consider the structure you would have chosen had it been known originally. Improve the affected design within the authorized scope and compatibility constraints. If the cleaner solution requires a broader redesign, explain the debt and seek a decision rather than silently expanding the work.

### Deep modules and information hiding (chapters 4–9)

- Prefer substantial capability behind a small, complete interface. Count informal contracts, call ordering, exceptions, configuration, and cleanup obligations as interface cost, not just signatures. An abstraction must hide unneeded details without hiding information callers need for correct use.
- Make common operations easy with sensible defaults and automatic behavior. Keep rare options out of the common path. Expose configuration when callers have useful knowledge the module cannot infer; otherwise prefer an appropriate policy or computed default over burdening every caller or administrator.
- Encapsulate design decisions: representations, formats, algorithms, and assumptions should have one owner. Private fields with getters/setters that expose the representation still leak information. Prefer capabilities over mutable internal collections. Organize around shared knowledge rather than execution order; separate read/write stages may still belong together if they share a format.
- Seek somewhat general-purpose interfaces: a small set of operations general enough for multiple uses, with functionality driven by current needs rather than speculative ones. Check that ordinary callers need neither excessive glue nor inefficient sequences of tiny operations. Avoid speculative frameworks and unnecessary future features. Keep application-specific policy separate from reusable mechanisms.
- Each layer should offer a different abstraction. Question pass-through methods, forwarding wrappers/decorators, and arguments threaded through layers that do not use them. Keep a wrapper when it adds a real contract or behavior. A context object can reduce argument plumbing, but must not become an opaque dependency bag, global singleton, or source of mutable shared-state races.
- Pull related complexity into its owning module when that simplifies callers and the interface, even if implementation gets harder. Do not push unrelated application policy down or collapse everything into one class.
- Combine code when it shares knowledge, is used together, belongs to one concept, or cannot be understood independently. Separate genuinely independent concepts and general mechanisms from special-purpose handlers. Extract substantial repetition only when the resulting interface is simpler; tiny, context-dependent duplication may be cheaper than a coupled helper.
- Split methods when each part has an independently understandable abstraction. Avoid conjoined helpers that require constant navigation, or APIs that force callers to invoke paired operations and shuttle intermediate state. Long, coherent methods can be clearer than many shallow ones; fixed line-count limits and many tiny classes do not establish good design.

### Design it twice, interface first (chapters 11, 15)

- Design it twice for consequential choices: sketch at least two meaningfully different approaches and compare interface cost, caller effort, information hiding, implementation complexity, and performance. Consider a third or a combination if both are awkward. Scale this exercise to the change; do not reopen a settled brief without evidence of a problem.
- Draft the abstraction, important signatures, interface comments, and data meanings before implementing new bodies; revise them as the design changes. Minimize preconditions rather than only documenting them.

### Paradigms, process, and performance design (chapters 19–20)

- Judge trends and patterns by complexity reduction. Interface inheritance can support a deep abstraction; implementation inheritance couples parents and subclasses through state and overrides. Consider composition or helpers; if inheriting implementation, control shared state through its owner. Getters/setters and design patterns must earn their interface cost.
- Use iterative development to build coherent abstractions rather than accumulating isolated feature patches. Test-first work must not replace whole-abstraction design.
- For a measured critical path, sketch the minimum common-case work independently of the current structure, then design clean abstractions around it. Move exceptional work off that path where semantics allow, reduce redundant checks and shallow calls, and consider effects on other common operations. Preserve ownership, correctness, and the full error contract.

{{ template "software-design-code.md" . }}
{{ template "software-design-red-flags.md" . -}}
