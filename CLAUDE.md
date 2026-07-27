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

## Commands

```bash
npm run dev      # dev server (Turbopack is the default bundler in Next 16)
npm run build    # production build — also the type-check
npm run start    # serve the production build
npm run lint     # eslint (flat config, no file args needed)
```

No test runner is configured and there is no migration step — don't go looking for either.
To verify a change, run `npm run build` and open the affected page in the dev server. If
tests are ever added, the DB-free pure modules (`overload.ts`, `validation.ts`,
`findCanonical()`) are the surface worth covering; everything else needs a live SQLite file.

## Environment & local data

- Keys live in `.env.local` (gitignored); `.env.example` documents them. **Both are optional** —
  `ANTHROPIC_API_KEY` unlocks real AI generation (demo plans otherwise), and `WORKOUTX_API_KEY`
  is read only by `scripts/sync-exercises.py`, never by the app.
- The database is `data/bodycraften.db`, gitignored. There is no reset command: **deleting
  `data/` is the reset** — the next boot recreates the tables and re-seeds the exercise library.
  (`resetWorkoutHistory()` in the UI is narrower: it clears logged sessions only.)

## Architecture

Single-user gym tracker: log workouts, track progressive overload, build/schedule plans,
generate plans with AI. App Router pages in `src/app/` — `/` (dashboard), `/log`, `/plans`,
`/exercises`, `/generate`, `/settings` — plus one API route, `POST /api/generate`.

The data flow is the thing to internalize:

- **Reads** live in `src/lib/queries.ts` (`server-only`). Server components call them directly.
  They are **synchronous** functions (better-sqlite3 is sync — `.all()` / `.run()`, never
  `await` a Drizzle call); only the ones that need the locale cookie are `async`.
- **Writes** live in `src/lib/actions.ts` (`"use server"`). Every mutation calls
  `revalidatePath("/", "layout")` and returns `ActionResult<T>`
  (`{ ok: true, data }` | `{ ok: false, error }`) — callers branch on `.ok`, nothing throws.
- Pages are server components that fetch and pass plain data down to `"use client"`
  components in `src/components/<feature>/`, which call actions and surface results via
  `sonner` toasts. DB-backed pages set `export const dynamic = "force-dynamic"`.

## Gotchas & conventions

- **The schema lives in two places that must stay in sync.** `src/db/index.ts` creates tables
  from a `BOOTSTRAP_SQL` string (`CREATE TABLE IF NOT EXISTS`, run on first boot — there are no
  migrations). `src/db/schema.ts` is the typed Drizzle mirror. Change a column in one, change it
  in the other (snake_case in SQL, camelCase in Drizzle).
- **`better-sqlite3` is a native module:** server-only, listed in `serverExternalPackages`
  (`next.config.ts`). Never import it (or `@/db`, `queries.ts`, `exercise-catalog.ts`) from a
  client component. The DB file (`data/bodycraften.db`, WAL mode, gitignored) is created and
  seeded from `src/db/seed-exercises.ts` on first boot; the `db` instance is memoized on
  `globalThis` for dev hot-reload.
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
  and recreating a day would cascade-delete every schedule entry pointing at it.
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

- **Add or change a DB column** → `BOOTSTRAP_SQL` in `src/db/index.ts` (snake_case) **and**
  `src/db/schema.ts` (camelCase). An existing `data/bodycraften.db` will *not* pick up the
  change — `CREATE TABLE IF NOT EXISTS` skips tables that already exist, so delete `data/`
  or `ALTER TABLE` by hand.
- **Add a user-visible string** → `en` first in `src/lib/i18n/dictionaries.ts`, then `es`
  (`Dictionary = typeof en`, so the compiler catches the missing `es` key, not the reverse).
  Use `{name}` placeholders + `fmt()`, never string concatenation.
- **Add a server action** → `"use server"`, return `ActionResult<T>` (never throw), call
  `revalidateApp()` before returning ok, and take error text from `t.actions.*` — not a
  hardcoded English literal.
- **Add a page that reads the DB** → `export const dynamic = "force-dynamic"`, fetch in the
  server component, pass plain serializable data to the client component.
- **Add a query** → `src/lib/queries.ts`, synchronous unless it needs the locale cookie.
  Never import it, `@/db`, or `exercise-catalog.ts` from a `"use client"` file.
- **Store an exercise name** → run it through `findCanonical()` so the DB keeps the English
  name; localized labels only ever ride along in `displayName`.
- **Add a numeric input** → a `sanitize*` helper on change **and** an `is*` predicate at
  submit, then re-check the same predicate inside the action.
- **Add an animation** → build it from `src/components/motion.tsx`, or honor
  `useReducedMotion()` yourself.
