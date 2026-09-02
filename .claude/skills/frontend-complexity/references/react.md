# React

## Container / presentational mapping

- A **route** renders a **page/container component** — the router is your "routing table describes your features" layer.
- The container calls **custom hooks** to reach its data sources — `useX()` wrapping React Query/SWR for server-cache state, `useState`/`useReducer` for local UI state, `useSearchParams` for URL state — and passes plain values down as props. Custom hooks are the React equivalent of Angular's `async` pipe: they hide fetch/subscription lifecycle behind a declarative call, so the container never manually wires up `useEffect` + fetch + `setState`.
- **Presentational components** are a function of their props: render JSX, call callback props on user interaction, nothing else. No data-fetching hooks beyond pure ones like `useMemo`/`useCallback` for view-only computation.
- If you're threading the same prop through four or more layers, that usually means a piece of state belongs at a different boundary (context, or the container should sit lower in the tree) — it isn't by itself a reason to reach for global state.

## Server Components / Server Actions apps (Next.js App Router, etc.)

The hook-based mapping above assumes a client-rendered SPA fetching over the network. A
framework with React Server Components changes where "server-cache state" lives — the mapping
still holds, the mechanism doesn't:

- The **container is the `async` server component** itself. It fetches directly from the data
  source (DB query module, ORM) in the component body — no `useX()` hook, no React Query/SWR,
  no client-side fetch waterfall. That *is* the server-cache boundary in this architecture.
- **Server Actions are for mutations, not data fetching.** Don't reach for one to read data —
  it queues, forcing sequential execution — and don't route Server Component reads through a
  Route Handler either (extra round trip, fails at build time for statically rendered routes).
- Presentational components under that container are unchanged: still `"use client"` only where
  they need interactivity/hooks, still pure functions of props, still call callback props (which
  for a write is "call this Server Action") instead of importing one themselves.
- `useState`/`useReducer` for local UI state and `useSearchParams` for URL state still apply
  as-is inside client components — nothing above changes client-side UI state, only where
  server-cache state is read.

## Data & state

- Wrap raw fetch/DTO shapes in a mapping function (or inside the query hook itself) so components never see the server's exact response shape.
- Classify state the same way regardless of library: server cache (React Query/SWR — treat as a cache, not owned state), URL (search params/router state), local UI (`useState`), derived (`useMemo`, never a separate `useState`).

## Volume: route-level code-splitting

Use `React.lazy` + `Suspense` (or your router's built-in lazy-route support — Next.js, TanStack Router, React Router all have one) so a route's code only downloads when someone visits it. This is the "shipped volume" dimension from the core rules — separate from how well-decomposed the feature's source files are.

## Building presentational components in isolation

Storybook is the standard tool here and works the same way across React, Vue, and Angular; Ladle is a lighter React-only alternative if Storybook's build overhead isn't worth it for your repo size.

## Also worth knowing: Vercel's react-best-practices skill

Vercel Engineering publishes and maintains an agent skill covering React/Next.js performance specifically — waterfalls, bundle size, re-renders, rendering strategy. It's a different layer from this one (performance idiom vs. architecture/complexity) and the two don't conflict. As with any third-party skill, it's worth the same review you'd give a new dependency before adding it to a regulated or audited repo.

## Common smells to flag

- A `useEffect` that manually fetches and calls `setState` where a data-fetching hook (or a plain async function called from an event handler) would remove the effect entirely.
- A presentational component importing a store hook (`useSelector`, a Zustand hook, etc.) or calling `fetch` directly.
- Prop-drilling used as a substitute for reconsidering where the container boundary should sit.
