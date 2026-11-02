### Design red flags

Each flag is a prompt to examine alternatives, not proof of a defect. Require a concrete consequence before recommending a change.

- **Shallow module**: the interface costs nearly as much to learn as the implementation it hides, such as a wrapper that renames one call.
- **Information leakage**: one design decision (a format, protocol, ordering, or layout) is known in more than one module, so changing it needs coordinated edits.
- **Temporal decomposition**: code split by the order things happen (read, then parse, then write) rather than by what each part knows, so the pieces share knowledge of one format.
- **Overexposure**: callers of the common case must learn about rarely used options or features.
- **Pass-through method or variable**: a method that forwards to another with nearly the same signature, or a value threaded through layers that never use it.
- **Repetition**: the same nontrivial logic in several places.
- **Special-general mixture**: one caller's special case written into a general-purpose mechanism.
- **Conjoined methods**: two pieces of code that cannot be understood without reading each other.
- **Comment repeats code**: the comment says what the adjacent code already says.
- **Implementation detail in interface docs**: an interface comment describes internals callers do not need.
- **Vague name**: `data`, `info`, `handle`, `result`, or similar where a precise name exists.
- **Hard to pick a name**: no precise name fits, which suggests the thing lacks a clean purpose.
- **Hard to describe**: a complete interface comment needs many caveats, which suggests the interface is too complex.
- **Nonobvious code**: a reader cannot quickly tell what the code does or why.
