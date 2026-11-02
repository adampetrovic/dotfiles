# Architecture, coupling, and consequential decisions

Sources: [07] *Fundamentals of Software Architecture*, second edition, 2025; [08] *Software Architecture: The Hard Parts*, first edition; [09] *Balancing Coupling in Software Design*. IDs refer to `sources.json`. Filename dates and copyright fields differ for some supplied files; do not infer an edition from a filename alone.

## Start with outcomes and uncertainty

Define the problem, constraints, comparable options, expected consequences, and reasons the costs are acceptable. Compare options at similar scope. Identify assumptions that would reverse the decision. Use a bounded spike when reasoning cannot resolve consequential uncertainty; do not invent numerical precision to rank incomparable options. [07, chs. 1–2, 19, 27; 08, chs. 1, 15.]

Translate quality words into prioritised, observable scenarios. “Fast” needs a workload and latency measure; “available” needs a workflow, failure model, and tolerated interruption. Different parts of a system can need different targets. Separate confirmed requirements from inferred needs and stakeholder assumptions. Composite goals such as agility cannot be proved by one convenient proxy. [07, chs. 4–7, 25; 08, chs. 1, 3.]

Connect architecture checks to required properties: permitted dependencies, cycles, boundaries, deployment composition, resource limits, or operational behaviour. Choose application-specific thresholds and actionable failures. Coverage percentages, dependency counts, and complexity scores alone do not prove fitness. Use manual evaluation where automation cannot assess the concern. Record consequential decisions with context, alternatives, consequences, and verification; supersede records rather than erasing rationale. [07, chs. 6, 21–22, 26; 08, chs. 5, 14–15.]

## Name the coupling and its cost

Distinguish static dependencies, runtime calls, model sharing, timing requirements, transactional consistency, and coordinated deployment. Trace which code, data, tests, releases, and teams must change together. Replacing a call with an event can reduce immediate availability dependence while retaining shared knowledge and ordering obligations. [08, chs. 2, 15; 09, chs. 1, 5–8.]

Evaluate the knowledge crossing a boundary, the distance over which change must propagate, and the expected volatility of that knowledge. Nearby strong relationships can be cohesive; forcing unrelated responsibilities into one lifecycle can create local complexity. Strong relationships spread across services or teams can create global complexity. Stable relationships can make an imperfect boundary economical, without making intrusive access safe. The book's numerical scales are subjective aids, not computed architecture-quality scores. [09, chs. 7–10.]

Different taxonomies answer different questions. Connascence describes agreements in names, types, meaning, algorithms, position, ordering, timing, values, and identity. Integration strength distinguishes intrusive implementation knowledge, functional rules, shared domain models, and integration contracts. A small payload can still carry a strong semantic agreement; a DTO mirroring every private field may hide nothing. Use the taxonomy to explain the mechanism, not to decorate every review. [09, chs. 5–7; 07, ch. 3.]

Preserve essential coupling. If a business invariant needs an immediate atomic decision, transport changes cannot remove that requirement. Colocate the responsible state or reconsider the boundary. Do not separate strongly related decisions merely to achieve a service-count or coupling metric, and do not merge unrelated entities merely because references make it convenient. [08, chs. 7, 9, 11–12; 09, chs. 11, 13.]

## Choose reuse and deployment boundaries deliberately

Repeated text is not always repeated knowledge. Independently evolving policies can deserve separate implementations. Copies of one mandatory rule remain coupled because updates must reach every copy. Compare replication, libraries, services, and sidecars by ownership, adoption cost, runtime failure, latency, and blast radius. Neither DRY nor duplication is an unconditional default. [08, ch. 8 “Reuse Patterns”; 09, chs. 3, 7, 10–11.]

Modularity does not require separate deployments. A modular monolith can provide domain boundaries without network or independent-release costs. Distribution should serve a demonstrated need such as distinct scaling, change rates, security isolation, or fault containment. Atomic transactions, interdependent data, volatile shared logic, and excessive workflow traffic are integrating forces. Check whether operations, deployment automation, and ownership can sustain the topology. A coarse service-based architecture can be a suitable endpoint. [07, chs. 11, 14, 18–19, 26; 08, chs. 3–4, 7.]

## Separate communication, coordination, and consistency

Synchronous versus asynchronous transport, orchestration versus choreography, and atomic versus eventual consistency are separate choices. An asynchronous acknowledgment establishes acceptance, not completion or correctness. Queues buffer bursts, not unlimited sustained overload. Define durable acceptance, completion tracking, ordering, retries, failed-message handling, repair, and overload behaviour. Do not infer weak coupling merely from a broker. [07, chs. 7, 15, 19; 08, chs. 2, 9, 11–12; 09, chs. 7–8, 11.]

Orchestration centralises workflow state and recovery but adds a coordination dependency and possible bottleneck. Choreography allows independent reactions but distributes workflow knowledge and failure handling. For a complex workflow, explicit orchestration may reduce total complexity. Describe states, transitions, error paths, repair, and escalation. Compensation can fail and does not imply rollback, isolation, or atomicity. [07, chs. 15, 20; 08, chs. 11–12.]

## Assign data ownership before access mechanisms

Start with who may write and who enforces invariants. Read access alone does not establish ownership. For joint writes, compare splitting data, broadening a coherent domain, delegating writes, or consolidating services. Then compare an owning API, replication, caches, or shared data domains against latency, availability, stale-data tolerance, schema evolution, and transaction needs. [08, chs. 6, 9–10.]

A shared database broadens coordination and deployment obligations but may be deliberate. One database per service belongs to a particular independence model; it is not a universal rule. Likewise, ports and adapters should protect actual domain boundaries, not promise effortless database interchangeability while hiding transaction or performance facts required for correctness. [07, chs. 7, 11, 14, 18, 20; 08, chs. 6, 9–10; 09, ch. 13.]

Domain-owned analytical data products, service meshes, replicated caches, and other specialist patterns need their own operating model. Data mesh does not make operational and analytical stores share a real-time transaction. Introduce these mechanisms only with a stated problem, guarantees, ownership, and recovery plan. [08, chs. 8–14; 07, chs. 16, 20, 24.]

## Reassess when assumptions change

Business differentiation, volatility, or team boundaries can change the cost of a previously acceptable design. Change history is evidence, not a direct volatility score: many commits can indicate defects, and few can indicate fear of brittle code. Revisit a consequential decision when requirements or observed outcomes change, not as routine redesign ceremony. [09, chs. 8–11; 07, chs. 21–22, 27.]
