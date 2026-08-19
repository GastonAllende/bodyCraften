# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ Next.js here is **16.2.9** with breaking changes from older versions. Route
> `params`/`searchParams` and `cookies()`/`headers()` are **async** — await them.

Docs ship with the package. Read the file that covers what you're touching rather than
grepping the whole tree — paths are relative to `node_modules/next/dist/docs/`:

| Touching | Read |
| --- | --- |
| a server action in `actions.ts` | `01-app/01-getting-started/07-mutating-data.md` |
| `POST /api/generate` | `01-app/01-getting-started/15-route-handlers.md` |
| `export const dynamic` on a page | `01-app/02-guides/caching-without-cache-components.md` |
| the locale cookie | `01-app/03-api-reference/04-functions/cookies.md` |
| `revalidatePath` | `01-app/03-api-reference/04-functions/revalidatePath.md` |
| `src/proxy.ts` | `01-app/03-api-reference/03-file-conventions/proxy.md` |

## Commands

```bash
npm run dev      # dev server (Turbopack is the default bundler in Next 16)
npm run build    # production build — also the type-check
npm run start    # serve the production build
npm run lint     # eslint (flat config, no file args needed)
```

No test runner is configured. There **is** a migration step now (drizzle-kit, see below) — don't
go looking for a test runner, but do go looking for `drizzle/` migration files before assuming
`schema.ts` alone is the source of truth. To verify a change, run `npm run build` and open the
affected page in the dev server against the real Supabase project (there's no local Postgres —
Supabase hosts it). If tests are ever added, the DB-free pure modules (`overload.ts`,
`validation.ts`, `findCanonical()`) are the surface worth covering; everything else needs a live
Supabase connection.

## Environment & local data

- Keys live in `.env.local` (gitignored); `.env.example` documents them. The Supabase/Postgres
  vars are **required** — the app has no database without them: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooled, port 6543,
  used by the app at runtime), `DIRECT_URL` (direct, port 5432, used only by drizzle-kit).
  `ANTHROPIC_API_KEY` (real AI generation, demo plans otherwise) and `WORKOUTX_API_KEY`
  (`scripts/sync-exercises.py` only) stay optional.
- The database is Supabase Postgres — no local file, no `data/` directory anymore. Schema changes
  go through drizzle-kit migrations (`npm run db:generate` then `npm run db:migrate`, both source
  `.env.local` via `dotenv-cli`), not an implicit bootstrap-on-boot. The built-in exercise catalog
  is seeded once via `npm run db:seed` (`scripts/seed-exercises.ts`), not on every app start.
  `resetWorkoutHistory()` in the UI is narrower still: it clears the signed-in user's logged
  sessions only.
- Row Level Security is enabled on every table (`supabase/rls.sql`, run once via the Supabase SQL
  editor) as **defense-in-depth only** — see the RLS note in Architecture below before assuming it
  does anything for the app's normal read/write path.

## Architecture

Multi-user gym tracker: log workouts, track progressive overload, build/schedule plans, generate
plans with AI. Authentication is Supabase Auth (email/password, verification, password reset).
App Router pages in `src/app/` — `/` (dashboard), `/log`, `/plans`, `/exercises`, `/generate`,
`/settings` — plus the `(auth)` route group (`sign-in`, `sign-up`, `forgot-password`,
`reset-password`), `src/app/auth/callback/route.ts`, and `POST /api/generate`.

The data flow is the thing to internalize:

- **Reads** live in `src/lib/queries.ts` (`server-only`). Server components call them directly.
  Every function takes `userId` as its first argument and is **async** (postgres-js/Drizzle is
  promise-based — `await` every call, there is no more `.all()`/`.run()`).
- **Writes** live in `src/lib/actions.ts` (`"use server"`). Every mutation calls `getUser()`
  itself first (see Auth below), threads the resulting `userId` through every insert/update/
  delete, calls `revalidatePath("/", "layout")`, and returns `ActionResult<T>`
  (`{ ok: true, data }` | `{ ok: false, error }`) — callers branch on `.ok`, nothing throws.
- Pages call `requireUserId()` (`src/lib/auth.ts`) first, then fetch and pass plain data down to
  `"use client"` components in `src/components/<feature>/`, which call actions and surface
  results via `sonner` toasts. DB-backed pages set `export const dynamic = "force-dynamic"`.

## Auth

- **Supabase Auth**, via `@supabase/ssr`. `src/lib/supabase/client.ts` (browser) and
  `src/lib/supabase/server.ts` (Server Components/Actions, `await cookies()`) build the two
  clients; never reach for `@supabase/supabase-js` directly outside those two files.
- **`src/lib/auth.ts`** — `getUser()` (revalidates the JWT against Supabase; don't swap in
  `getSession()`, which trusts a possibly-stale cookie) and `requireUserId()` (redirect-to-sign-in
  variant, for pages). **`src/lib/auth-actions.ts`** — `signUp`/`signInWithPassword`/
  `requestPasswordReset`/`updatePassword`/`signOut`, same `ActionResult<T>` convention as
  `actions.ts`.
- **`src/proxy.ts`** refreshes the Supabase session cookie and redirects unauthenticated visitors
  to `/sign-in`. This is a convenience layer, **not** the security boundary — a matcher change
  here can silently stop covering a route, so every Server Action independently calls `getUser()`
  regardless of what the proxy already checked. Don't remove an action's own check because "the
  proxy already handles it."
- **RLS is enabled on every table but is defense-in-depth, not enforcement.** A direct Drizzle
  connection over `DATABASE_URL` never goes through PostgREST, so `auth.uid()` is `NULL` in that
  path and RLS policies (`supabase/rls.sql`) have no effect on `queries.ts`/`actions.ts`. The
  `user_id` filtering in those two files is the actual boundary — if you drop a filter there, RLS
  will not save you.
- Every top-level table has a `user_id uuid references auth.users(id)`; child tables
  (`workout_sets`, `plan_days`, `plan_exercises`) don't — they're scoped by resolving the owned
  parent rows first (same pattern in every `queries.ts` function). `exercises.user_id` is
  **nullable**: `NULL` means the shared built-in catalog, non-null means a specific user's
  custom/imported row (see `getLibraryExercises()`).

## Gotchas & conventions

- **The schema is `src/db/schema.ts` (pg-core) plus `src/db/auth-schema.ts`** (a minimal stub for
  Supabase's `auth.users`, so `user_id` columns can `.references()` it without drizzle-kit trying
  to create the `auth` schema itself). Changing a column means editing `schema.ts` and running
  `npm run db:generate` (writes a migration under `drizzle/`) then `npm run db:migrate` — there is
  no more implicit bootstrap-on-boot and no second SQL string to keep in sync by hand.
- **`src/db/index.ts` exports a lazy `getDb()` function, not a `db` constant.** Constructing the
  postgres-js client eagerly at module-eval time can crash `next build`'s static analysis pass if
  `DATABASE_URL` isn't loaded yet, so every call site does `getDb().select()...` instead of
  importing a pre-built client. **Never wrap it in a `Proxy`** — Supabase/Postgres tooling that
  inspects the client's shape breaks silently behind one; the memoization is a plain lazy `let`.
  Never import `@/db`, `queries.ts`, or `exercise-catalog.ts` from a client component.
- **The pooled `DATABASE_URL` (port 6543, Supavisor transaction mode) needs `prepare: false`** on
  the postgres-js client — already set in `src/db/index.ts`. Removing it reintroduces intermittent
  "prepared statement does not exist" errors under load. Migrations use the separate `DIRECT_URL`
  (port 5432) instead, via `drizzle.config.ts` — don't point `drizzle-kit` at the pooled URL.
- **The exercise catalog is no longer seeded on app boot.** `npm run db:seed`
  (`scripts/seed-exercises.ts`) is a one-time, idempotent script — run it once after the first
  migration, not on every deploy.
- **Exercises are referenced by name (string), not foreign key** across workouts, plans, and the
  library — so deleting a library row leaves history intact. Logging upserts unknown names into
  the `exercises` table.
- **The exercise name stored in the DB is always the canonical English one.** A translated label
  travels only in `LibraryExercise.displayName`; writes go through `findCanonical()`
  (`src/lib/exercise-catalog.ts`) so a save made from the Spanish UI still stores English facets.
  Writing a localized name would split a user's history the moment they switch language.
- **i18n is dictionary-based, not route-based.** The locale lives in a cookie (`src/lib/i18n/config.ts`),
  read server-side by `getLocale()` / `getDictionary()` (`i18n/server.ts`) and client-side by
  `useI18n()` (`src/components/i18n-provider.tsx`). `Dictionary = typeof en`, so the compiler
  forces `es` to cover every key in `src/lib/i18n/dictionaries.ts` — add English first. Templates
  use `{name}` placeholders interpolated by `fmt()`. Server actions return already-translated
  error strings from `t.actions.*`. Switching language = `setLocale()` action + `router.refresh()`.
- **The exercise catalog is vendored, with no runtime API.** `src/db/exercises.json` (1321 canonical
  rows) plus `src/db/exercises.es.json` (display-only overlay keyed by the same id) are imported
  directly. `bodyPart` is an app-owned facet: vendor vocabulary is folded into the seed library's
  buckets by `toBodyPartBucket()`, and the labels are translated in `dictionaries.ts`.
  `getExerciseCatalogMerged()` merges the catalog with saved library rows (local rows win on
  identity, catalog wins on every displayed field). Re-syncing is a manual, offline step:
  `WORKOUTX_API_KEY=... python3 scripts/sync-exercises.py` (~10 min, rate-limited).
- **AI plan generation degrades gracefully when `ANTHROPIC_API_KEY` is absent** — `POST /api/generate`
  falls back to `src/lib/demo-plan.ts` and the UI flags it as a demo. Never treat the missing key
  as an error to fix. The real path uses `client.messages.parse()` with `zodOutputFormat` and model
  `claude-haiku-4-5`, which supports neither `thinking` nor `effort` (both 400) — see the comment
  in `src/app/api/generate/route.ts` before touching the request.
- **Progressive-overload + date math is centralized in `src/lib/overload.ts`** (Epley 1RM, volume,
  streaks, formatting). Dates are `yyyy-MM-dd` strings everywhere — use those helpers, not ad-hoc
  `Date`. PR detection happens in `saveWorkout()`: it compares each exercise's best estimated 1RM
  against its prior best across all history.
- **Numeric input rules are shared, and enforced twice** (`src/lib/validation.ts`): `sanitize*`
  runs on every keystroke so bad characters never enter state; `is*` predicates gate submission
  **and** are re-checked in the action, since a server action is a public endpoint.
- **`updatePlan()` rewrites a plan in place and preserves `plan_days` ids on purpose** — dropping
  and recreating a day would cascade-delete every schedule entry pointing at it. Ownership is
  checked exactly once, on the initial `plans` lookup (`plans.id = id AND plans.user_id = userId`);
  every write after that is safe purely because that check gates them, since `plan_days`/
  `plan_exercises` carry no `user_id` of their own. Don't add a new write path into this function
  without routing it through that same initial check.
- **Tailwind is v4 (CSS-first):** theme config lives in `src/app/globals.css` via `@theme` — there
  is no `tailwind.config.*`. The brand palette (orange/navy, oklch) and the light/dark variable
  sets are defined there; `next-themes` provides class-based theming and **defaults to dark**.
- **Animation goes through `src/components/motion.tsx`** (`FadeIn`, `Stagger`, `StaggerItem`) and
  `src/app/template.tsx` (cross-page fade). Anything animated must honor `useReducedMotion()`,
  as those helpers do.
- **shadcn/ui uses the `radix-nova` preset** over the unified `radix-ui` package (`components.json`).
  `src/components/ui/` is generated — prefer wrapping over editing those files. Icons: `lucide-react`.

Cross-boundary DTOs live in `src/lib/types.ts`; Drizzle row types in `src/db/schema.ts`.

## If you touch X, also touch Y

Each of these is an invariant nothing enforces at build time — the compiler stays quiet and
the app breaks at runtime (or silently) instead.

- **Add or change a DB column** → `src/db/schema.ts`, then `npm run db:generate` **and**
  `npm run db:migrate` (both source `.env.local`). If the column carries per-row ownership,
  decide whether it belongs on a top-level table (gets its own `user_id`) or a child table
  (scoped through its parent instead — see the Auth section).
- **Add a user-visible string** → `en` first in `src/lib/i18n/dictionaries.ts`, then `es`
  (`Dictionary = typeof en`, so the compiler catches the missing `es` key, not the reverse).
  Use `{name}` placeholders + `fmt()`, never string concatenation.
- **Add a server action** → `"use server"`, call `getUser()`/`requireUser()`-style check as the
  *first line* (independent of `src/proxy.ts`), return `ActionResult<T>` (never throw), call
  `revalidateApp()` before returning ok, take error text from `t.actions.*` — not a hardcoded
  English literal — and make sure every `UPDATE`/`DELETE` by id is scoped `AND user_id = userId`,
  treating zero rows affected as a not-found error rather than a silent success.
- **Add a page that reads the DB** → `export const dynamic = "force-dynamic"`, call
  `requireUserId()` first, fetch in the server component, pass plain serializable data to the
  client component.
- **Add a query** → `src/lib/queries.ts`, `async`, `userId: string` as the first parameter, and a
  `user_id` filter on every top-level-table `SELECT` (child tables: resolve the owned parent ids
  first, then filter by them). Never import it, `@/db`, or `exercise-catalog.ts` from a
  `"use client"` file.
- **Store an exercise name** → run it through `findCanonical()` so the DB keeps the English
  name; localized labels only ever ride along in `displayName`.
- **Add a numeric input** → a `sanitize*` helper on change **and** an `is*` predicate at
  submit, then re-check the same predicate inside the action.
- **Add an animation** → build it from `src/components/motion.tsx`, or honor
  `useReducedMotion()` yourself.
