---
name: frontend-complexity 
description: Use this any time you're creating a new component, adding a new feature, or wiring up a new route in Angular, React, or Vue — including scaffolding, "add a component for X," "build a feature that does Y," or a new page/view. Also use it when writing, reviewing, or refactoring existing components, hooks/composables/services, or state management. Provides architectural guidance for managing complexity (state, flow control, and code volume): where new logic belongs, whether an abstraction is justified, how the container/presentational split should look, and how to classify state. Load the matching references/<framework>.md file for framework-specific wiring.
---

# Manage Complexity

Complexity isn't the enemy of ambitious code — it's the enemy of *changeable* code. Every rule below exists to keep one of three things from growing without a reason:

- **State** — anything that can change and has to be tracked. More state means more combinations to reason about.
- **Flow control** — every branch and loop multiplies the number of paths execution can take.
- **Volume** — sheer amount of code is a cost on its own: more to read, index, and hold in working memory.

When you're unsure whether a change is actually an improvement, ask which of the three it reduces. If the honest answer is "none — it just moved the complexity somewhere else," it isn't a win.

Read `references/angular.md`, `references/react.md`, or `references/vue.md` for how the architecture section below maps onto that framework's primitives.

## General rules

- **Fine-grained, single-purpose code.** A function, component, or module should do one thing. If describing it needs "and," split it.
- **Self-documenting first, comments second.** Names and structure should carry the intent. Reserve comments for *why* a decision was made, not *what* the code does — the code already says what.
- **Favor pure, immutable functions.** A pure function doesn't touch anything outside its inputs and treats those inputs as immutable. This isn't dogma for its own sake: pure functions are trivial to test in isolation, safe to reorder or run concurrently, and don't require you to hold execution history in your head to reason about them.
- **Abstraction is a tool, not a virtue.** An abstraction earns its place only if it does at least one of: reduce complexity, reduce coupling, increase cohesion, or increase portability. One that does none of these is just indirection with extra steps.
- **Composition over inheritance.** Build behavior by combining small pieces, not by extending a hierarchy — inheritance couples a class to every ancestor's future changes.
- **Don't confuse convention for repetition.** Two pieces of code that look similar but change for independent reasons aren't duplication — they're coincidence. Collapsing them into one abstraction creates false coupling: a change meant for one now has to worry about the other. Only unify code that changes *for the same reason, at the same time.*
- **Well-structured code has a larger surface area.** More small files and functions is usually a sign of good decomposition, not bloat. Don't optimize for fewer files.

## Volume has two faces

"Volume" in the intro cuts two ways, and they don't move together. **Cognitive volume** is how much code a person has to read and hold in their head — small, well-decomposed files address this. **Shipped volume** is how much code actually gets sent to and parsed by the browser — a feature can be beautifully decomposed into many small files and still ship as one large bundle if nothing lazy-loads it. Split code at the route/feature boundary by default so a feature's code only downloads when someone visits it; see the framework reference for the mechanism.

## Team-level judgment

- **Optimize around your actual team**, not an idealized one — the best pattern is the one your team can maintain, review, and extend confidently.
- **Favor boring best practices over clever idioms.** Clever is a cost paid by everyone who reads the code after you.
- **Consistency beats local righteousness.** A codebase that's 90% one way is easier to work in than one "correctly" split five different ways.
- **The style guide is a default, not a law.** Deviate when it genuinely doesn't fit — and say why in the diff, so the exception doesn't read as drift.

## Tactical rules

- **Eliminate hidden state.** Module-level mutable variables, closures over mutable references, and singletons mutated from multiple call sites are invisible dependencies — anything that reads them has to know about every writer.
- **Eliminate nested logic.** Prefer guard clauses and early returns over pyramids of `if`. Nesting is flow-control complexity made visible.
- **Replace flag soup with an explicit state shape.** Independent booleans like `isLoading`, `isError`, `hasData` allow states that should be impossible (loading *and* error at once). A single discriminated status — `status: 'idle' | 'loading' | 'error' | 'success'` — can't represent a state that doesn't exist.
- **Push side effects to the edges.** Keep the part of your code that makes decisions (business logic) pure and synchronous; isolate network calls, timers, storage, and DOM access at the boundary that calls into it. This is sometimes called a "functional core, imperative shell" — the core is where bugs are cheap to find, because it's just data in, data out.
- **Don't break single responsibility.** If a function, class, or component has more than one reason to change, split it.
- **Extract-function is your highest-leverage refactor.** When in doubt about how to simplify something, pulling a chunk of logic into a well-named function is almost always a safe, high-value first move.

## State: know which kind you're holding

Most "state bugs" are really a fact stored in the wrong place, or the same fact stored twice and left to drift. Before adding a piece of state, classify it:

- **Server/cache state** — owned by the backend; you're fetching, caching, and re-validating a snapshot of it. Treat it as a cache to synchronize with, not state your app owns.
- **URL state** — anything that should survive a refresh or be shareable via link (filters, active tab, page number).
- **Client/UI state** — ephemeral and local to the session (a modal being open, a draft in progress, hover/focus).
- **Derived state** — anything computable from other state. Never store it; compute it. A stored value duplicating a computation is a bug waiting for the two copies to disagree.

Conflating these — most commonly, treating server data as if it were plain client state — is one of the most common sources of accidental complexity in frontend apps.

## Component architecture

This pattern is framework-agnostic; see the matching reference file for how each framework implements the "reactive boundary" part.

- **Your routes generally mirror your features.** A route renders a *container* component (also called "smart" or "connected").
- **Everything under a container is a presentational component** ("dumb").
- **A presentational component does exactly two things:** consume just enough data to satisfy its template, and capture user events to delegate upward. It owns markup, styling, and accessibility — nothing else.
- **Presentational components are oblivious to business logic, server communication, and where application state lives.** That obliviousness is *why* they're portable and trivial to test — you can render one with plain props and assert on emitted events, no mocking required.
- **Containers are the seam.** They gather data (server cache, app state, route params), wire it into presentational components' inputs, and route emitted events to the right handler. A container should consume its data sources declaratively at that boundary rather than manually subscribing/unsubscribing and pushing values into local fields — manual subscription management is hidden lifecycle state you now have to get right every time.
- **If business logic shows up in a presentational component, that's a container problem** — not a reason to make an exception.
- **Build and test presentational components in isolation** before wiring them into a container — a tool like Storybook (or a lighter equivalent) renders a component with no container, no store, and no network available. If a component can't run there, that's a sign a data dependency or business logic leaked into it; the isolation environment doubles as an enforcement mechanism for the boundary, not just a demo tool.
- **Presentational components pair naturally with a design system.** A shared set of tokens (spacing, color, type) and base components gives every presentational component the same visual vocabulary, instead of each feature re-deciding button and spacing conventions from scratch. This isn't a state/flow/volume rule on its own, but it's what keeps a large set of small presentational components from drifting into inconsistent one-offs.

## Decoupling backend and frontend

- Agree on a data contract early enough that the frontend can build and test against mocked data before the backend endpoint exists.
- Map server DTOs into an internal view-model at the boundary (a container, or a dedicated adapter/mapper) — a backend shape change should touch one mapping function, not every component that consumed the raw response.
- Data models, server communication, and application-state management are three separate concerns. Keep them independently swappable — you should be able to replace your HTTP client or your state library without touching your components.

## Testability

- It's impossible to write good tests for bad code — if a test is painful to write, treat that as a diagnosis of the code's coupling, not a testing problem.
- Pure functions are the cheapest thing you can test. Push logic into them so more of your suite is fast, isolated pure-function tests rather than integration tests full of mocks.
- Presentational components: test by rendering with props and asserting on emitted events.
- Containers: this is where mocking server calls and app state belongs — and it should stay the minority of your test suite, not the majority.

## When to introduce an abstraction

- **Refactor through promotion.** Solve the concrete problem in place first. Once a second or third case proves the logic is genuinely general, *promote* it into a shared abstraction — don't design the abstraction speculatively before you have evidence you need it.
- **Rule of three.** Two similar things might be coincidence (see "convention vs. repetition" above). A third occurrence is usually a real signal.
- Re-check the abstraction test before you commit to it, not after: does it reduce complexity, coupling, cohesion, or portability?

## Keep diffs answerable

Where you can, don't mix a structural refactor with a behavior change in the same commit or PR — a diff that does both forces a reviewer to untangle "did this move or did this change" by hand. This matters everywhere, and it's non-negotiable in codebases with audit or compliance requirements, where a reviewer needs to be able to answer "what changed and why" from the diff alone.

## Self-review checklist

Before treating a change as done, check it against:

- [ ] Does every function/component do exactly one thing?
- [ ] Could this be pure? If not, is the side effect isolated at an edge rather than buried in logic?
- [ ] Is any piece of state duplicated, or derivable from other state instead of stored?
- [ ] Is there nesting deeper than two levels that a guard clause would flatten?
- [ ] Does a presentational component reference a service, store, or fetch call directly? (If yes, that logic belongs in the container.)
- [ ] Is this abstraction backed by a real second or third use case, or is it speculative?
- [ ] Does this diff mix a refactor with a behavior change?
