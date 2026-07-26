# Commands

```bash
npm run dev      # dev server
npm run build    # production build — this is also the type-check
npm run lint     # eslint
```

There is no test runner and no migration step — don't look for them. Verify a change with
`npm run build` plus the affected page in the dev server.

# Next.js

@AGENTS.md

Route `params` and `searchParams` are async — await them.

# Architecture

- **The schema lives in two places that must stay in sync.** `src/db/index.ts` bootstraps tables
  from a raw SQL string on first boot (there are no migrations); `src/db/schema.ts` is the typed
  Drizzle mirror. Change a column in one, change it in the other (snake_case in SQL, camelCase in
  Drizzle).
- **Reads go in `src/lib/queries.ts`** (`server-only`), **writes in `src/lib/actions.ts`**
  (`"use server"`). Every mutation calls `revalidatePath("/", "layout")` and returns
  `ActionResult<T>` (`{ ok: true, data }` | `{ ok: false, error }`) — callers branch on `.ok`,
  they don't throw. DB-backed pages set `export const dynamic = "force-dynamic"`.
- **Exercises are referenced by name (string), not foreign key** across workouts, plans, and the
  library. Logging upserts unknown names into the `exercises` table.
- **1RM, volume, streak, and date math belong in `src/lib/overload.ts`.** Dates are `yyyy-MM-dd`
  strings — use those helpers, not ad-hoc `Date`.
- Cross-boundary DTOs go in `src/lib/types.ts`.

# Gotchas

- **`better-sqlite3` is a native, server-only module** (listed in `serverExternalPackages`).
  Never import it client-side. `data/bodycraften.db` is created and seeded automatically.
- **`ANTHROPIC_API_KEY` is optional** (`.env.local`, see `.env.example`): without it, plan
  generation falls back to `src/lib/demo-plan.ts`. A missing key is not a bug to fix.
- **The exercise catalog is vendored, not fetched.** `src/db/exercises.json` holds the canonical
  rows and `src/db/exercises.es.json` is a display-only Spanish overlay keyed by the same id;
  `src/lib/exercise-catalog.ts` merges them per locale. There is no exercise API at runtime.
- **Exercise names are the join key, so only `displayName` may be translated.** `LibraryExercise.name`
  is canonical English and is what gets written to `workout_sets.exercise_name` /
  `plan_exercises.exercise_name`. Storing a localised name splits a user's history when they
  switch language.
- **Tailwind is v4 / CSS-first** — the theme lives in `src/app/globals.css` under `@theme`. There
  is no `tailwind.config.*`.
- **Don't edit `src/components/ui/`** (shadcn-generated) — wrap those components instead. This
  project is on the `radix-nova` style, not plain `radix-ui`.
