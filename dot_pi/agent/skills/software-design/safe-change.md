# Safe changes and useful tests

Sources: [04] Martin Fowler, *Refactoring*, second edition; [06] Michael Feathers, *Working Effectively with Legacy Code*; [13] Vladimir Khorikov, *Unit Testing: Principles, Practices, and Patterns*, supplied MEAP Version 3. IDs refer to `sources.json`. Draft-specific recommendations from [13] are not assumed to describe the final edition.

## Identify what may change

Separate intended behaviour changes from behaviour-preserving restructuring and performance work. State the observable boundary that must remain stable, including compatibility and timing requirements where they matter. Calling a replacement a refactoring does not establish equivalence. Switch between adding behaviour and restructuring in small, testable steps rather than mixing an unexplained rewrite into a feature. [04, ch. 2 “Defining Refactoring,” “The Two Hats”; 06, ch. 1 “Changing Software.”]

Trace effects from the changed code to return values, callers, mutated arguments, shared state, and inherited behaviour. Choose test points capable of observing the threatened outcome. One accessible test may protect several changed methods; a distant end-to-end test may impose too much setup and weak failure localisation. Check that the test actually traverses the relevant path and would catch the intended mistake. [06, chs. 11–13.]

## Reach a test harness without pretending it is risk-free

Characterisation tests record existing behaviour, including surprising behaviour. They do not prove that the software meets requirements. Preserve an observation while investigating whether clients depend on it; decide separately whether to correct it. For a confirmed bug, write a reproducing regression that expresses the intended result before fixing it when feasible. [06, ch. 13; 04, ch. 4 “Building Tests.”]

When dependencies prevent testing, introduce the smallest useful seam or observation point, inspect that change conservatively, and establish protection before broader cleanup. Compiler checks, searches, automated transformations, and review can reduce risk without proving equivalence. Reflection, dispatch, ownership, and language-specific behaviour can invalidate apparently mechanical edits. [06, chs. 2–4, 23, 25; 04, ch. 2 “Automated Refactorings.”]

A test subclass, exposed method, injected dependency, or wrapper can be a temporary route into a difficult system. State the compromise and containment boundary. Do not turn emergency scaffolding into the preferred public architecture or demand a wholesale redesign before allowing a small legacy fix. Tested sprouts or wrappers may leave old callers untested; report that coverage gap. [06, chs. 6, 9–11, 25; 13, ch. 11.]

## Change structure incrementally

Prefer small transformations with feedback. For interface migrations, a typical sequence is introduce a compatible entry point, delegate, migrate callers, verify, then retire the old path when authorised. Published or independently deployed clients may not all be searchable or migratable together. Preserve compatibility explicitly instead of assuming the repository contains every consumer. [04, ch. 6 “Change Function Declaration.”]

Check semantic preconditions: side effects, aliasing, assignment, dispatch, and ownership can make extraction, movement, or substitution unsafe. When a failure is hard to localise, return to a known-good state through the project's approved VCS workflow and retry in smaller steps; never discard unrelated work. A disposable exploratory refactor is not production validation. [04, chs. 1, 8 “Slide Statements,” 12 “Pull Up Method”; 06, chs. 16, 20, 24.]

Refactoring directions are reversible choices. Extraction and inlining, hiding delegates and removing middlemen, or replacing parameters and queries can each help in different contexts. A conditional alone does not require polymorphism; a smaller method helps when its name and boundary add meaning. Name the obstruction each structural change removes. [04, chs. 6–12.]

## Judge tests by what they protect

Assess regression protection, resistance to harmless refactoring, feedback speed, and maintenance cost. Coverage highlights omissions but does not establish meaningful assertions. Test behaviours and invariants, boundaries, failures, and important integration assumptions. Avoid tests whose only value is proving that a private helper or incidental call sequence exists. [13, chs. 1, 4; 04, ch. 4.]

Define a unit by the purpose and dependencies of the test, not automatically by one class. Several deterministic collaborators may form one behaviour-sized unit. Isolation can improve setup and localisation but can also freeze internal collaborations. Do not quote a universal speed threshold; report the actual runtime and what the test shares with others (database, clock, files, ports) that could make it interfere. [13, ch. 2; 06, ch. 2 and glossary.]

Distinguish data supplied by stubs from outgoing effects checked by interaction assertions. Mocking internal reads often asserts intermediate implementation rather than useful behaviour. Assertions about external notifications or other supported outgoing contracts can be valuable. State why each double exists, what it proves, and which assumptions about the real dependency remain unverified. [13, chs. 5, 9; 06, ch. 3 “Sensing and Separation.”]

Use integration evidence for persistence and other application-controlled infrastructure where its actual behaviour matters. A mock cannot establish database constraints, queries, or transaction semantics. If the environment is unavailable, report the gap and use whatever narrower checks remain useful rather than claiming integration success. [13, chs. 8, 10.]

## Decide how many tests a change needs

Count follows distinct behaviour, not lines or methods. A test earns its place when it adds regression protection that no existing test gives, at a maintenance cost the protection justifies. Each additional test that exercises an already-covered path adds cost and no protection. [13, chs. 1, 4.]

- Give one test to each distinct outcome or branch, including failure, retry and boundary outcomes. Two inputs that take the same path are one case.
- Extend the existing test of the changed unit before creating a new class. Create a new class for a new production unit.
- Use a parameterised test only when the rows reach different paths or produce different outcomes. Rows that all hit one validation path are one row.
- Skip getters, pass-through calls, constants, data-class equality and framework behaviour.
- Before deleting a test as redundant, check that it does not cover a boundary or error branch that the others reach only by accident.

Under-testing has the same signs in reverse: an untested boundary (limit, tolerance, empty and full), an untested failure of a dependency, or a flag with one branch covered. State the unprotected path when one remains.

## Keep tests deterministic and honest about their data

Practical additions, not drawn from a supplied book.

- Inject clocks, identifiers and randomness. Do not sleep or depend on test order, and make asynchronous waits explicit. Mark a known-flaky test visibly and track it; do not disable it silently.
- Check that a new test can fail. Revert the fix or break the behaviour and see the test fail, or confirm that it would. A test that passed before the change protects nothing about it.
- Label fixtures built from an assumed contract. When the real format or protocol is unseen, record what was assumed and what has not been verified, and replace the fixture with a captured real sample as soon as one exists. Passing tests built on an assumed format show only that the code matches the assumption.
- When a schema, wire format or flag changes behaviour for data that already exists, test reading old data with new code and, where rollout allows it, the reverse. Cover both branches of a flag and its default.
- A fake or in-memory stand-in is trustworthy only if the same contract test also runs against the real dependency. Prefer strict doubles, which fail on unexpected calls, so drift shows up as a failure.
- Name tests for the behaviour. Names and comments should not mention the ticket or "new" or "fixed" behaviour; when behaviour changes, edit the old expectation instead of adding a contradicting test.

## Separate decisions from effects when useful

A functional core or Humble Object can move decisions away from frameworks, I/O, clocks, and services, enabling simpler output-based tests. Domain events can represent decisions that orchestration later applies. Count the cost: eagerly fetching every input may waste I/O; fragmented stages and new interfaces can make a small operation harder to understand. Use the boundary when it reduces total work, not as a compulsory application skeleton. [13, chs. 6–7; 04, ch. 6 “Combine Functions into Class,” “Combine Functions into Transform.”]

## Keep disagreements explicit

Fowler and Feathers advocate short test-first feedback cycles, while legacy code can require bounded test-enabling changes before that cycle is possible. Ousterhout questions feature-by-feature TDD as a design strategy. Follow the repository's workflow and assess coherent abstractions separately; no TDD label proves design quality. [04, ch. 4; 06, chs. 8, 19, 25; 14, ch. 19.]

Feathers pragmatically accepts seams that Khorikov would reject as a destination design. Khorikov's supplied draft also makes strong recommendations about unmanaged boundaries and unavailable integration dependencies. Retain their context: use temporary access deliberately, prefer observable contracts, and never treat one author's mocking policy as a reason to discard useful tests or conceal missing evidence. [06, ch. 25; 13, chs. 8–11.]
