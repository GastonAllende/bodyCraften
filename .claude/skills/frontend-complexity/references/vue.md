# Vue

## Container / presentational mapping

- A **route** (vue-router) renders a **view/page component** acting as the container.
- The container calls **composables** (`useX()` — often backed by Pinia for app state or a query library for server-cache state) to get reactive refs/computed values, and passes them down as props. Vue's reactivity system is the `async`-pipe equivalent here: the template consumes refs/computed directly, with no manual subscribe/unsubscribe to manage.
- **Presentational components** declare `defineProps` / `defineEmits` (or the Options API equivalent), render from those props, and emit events — no composable calls beyond pure `computed()` helpers for view-only derivations.
- `provide`/`inject` is for genuinely cross-cutting, rarely-changing concerns (theme, i18n) — it isn't a substitute for a well-scoped prop chain.

## Data & state

- Map API responses into view-models inside the composable that fetches them, so components never touch the raw server shape.
- Classify state as usual: server-cache (a query composable, or Pinia with explicit "stale" handling), URL (route params/query via `useRoute`), local UI (`ref`/`reactive` inside the component), derived (`computed`, never a separate `ref`).

## Volume: route-level code-splitting

Use `defineAsyncComponent`, or vue-router's built-in support for lazy route components (`component: () => import('./View.vue')`), so a route's code only downloads once someone visits it — the "shipped volume" dimension from the core rules, separate from how well-decomposed the feature's source files are.

## Building presentational components in isolation

Storybook works with Vue the same way it does with React and Angular; Histoire is a lighter Vue-specific alternative if Storybook's overhead isn't worth it for your repo size.

## A note on ecosystem skills

Unlike Angular, Vue's core team doesn't currently publish an official agent skill — what's available is community-maintained, of varying quality and update cadence. Worth the same scrutiny you'd give any third-party dependency (who maintains it, how recently, what it's allowed to execute) before adding one to the repo, especially in an audited codebase.

## Common smells to flag

- A presentational component calling `useXStore()` directly instead of receiving the value as a prop.
- Manual `watch` + local `ref` reimplementing what a `computed` or a query composable would give for free.
- Business logic (validation, formatting rules) written inline in a `<script setup>` block of a presentational component rather than extracted to a plain function.
