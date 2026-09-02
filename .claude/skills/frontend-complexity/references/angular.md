# Angular

## Container / presentational mapping

- A **route** (in the routing table) points at a **container/page component**, typically injecting a facade or service rather than calling `HttpClient` or a store directly. Prefer `inject()` at the top of the class over constructor parameters — that's the current style guide recommendation, and it reads more clearly once a container injects several dependencies.
- Standalone is the default for new components — there's no need to set `standalone: true` explicitly, and no need for an NgModule unless you're extending a legacy one.
- For server data, prefer `resource()` / `httpResource()` over manually subscribing to an Observable: both expose `value()`, `isLoading()`, `error()`, and a single `status` signal (`'idle' | 'loading' | 'error' | 'reloading' | 'resolved' | 'local'`) — the discriminated-status pattern from the core rules, built into the framework. If you're on an RxJS/Observable-based data layer (common alongside NgRx), the **`async` pipe** is the equivalent: consume it declaratively in the template rather than subscribing in the class and assigning to a field, which means owning `ngOnDestroy` cleanup by hand.
- **Presentational components** use signal-based `input()` / `output()` (the `@Input()`/`@Output()` decorators still work, but signals are the current default). Inject nothing except perhaps pure pipes — no `HttpClient`, no store, no router inside a presentational component.
- In templates, prefer the built-in control flow (`@if`, `@for`, `@switch`) over the older `*ngIf` / `*ngFor` structural directives in any new or touched template.
- Business logic lives in plain, framework-agnostic functions or an injectable service/facade — not in the component class.

## Data & state

- Map raw HTTP responses (DTOs) into view-models in the service/facade layer — or inside the `resource`/`httpResource` loader itself — using a TypeScript interface as the contract. That interface is what the frontend can mock while the backend is still in progress.
- Whatever state approach you use (Signals, RxJS `BehaviorSubject`s, NgRx), still classify what you're storing: server-cache data, URL state (route/query params), local UI state, or derived state. Don't let one store collapse all four together — a `computed` should own anything derived.

## Volume: route-level code-splitting

Lazy-load at the route boundary with `loadComponent` / `loadChildren` so a feature's code only ships to the browser once someone visits it — the Angular mechanism for the "shipped volume" dimension in the core rules, independent of how well-decomposed the feature's own files are.

## Also worth knowing: official Angular Agent Skills

The Angular team publishes and maintains its own agent skills (`angular-developer`, `angular-new-app`) covering current syntax and idiom — signals, `linkedSignal`, `resource`, forms, DI, routing, SSR, accessibility, and CLI usage (`npx skills add https://github.com/angular/skills`). This skill and that one don't overlap much: this one is about where logic lives and how complexity is kept in check; theirs is about whether the code is idiomatic, current Angular. Worth installing both rather than duplicating their syntax guidance here.

## Common smells to flag

- A component subscribing manually (`.subscribe(...)`) instead of using the `async` pipe or a `resource`, especially without a corresponding `takeUntilDestroyed()` or explicit unsubscribe.
- A presentational component injecting a service via `inject()` or a constructor.
- Business rules (validation, calculations, formatting decisions) written inline in a template or component method instead of a pure function.
