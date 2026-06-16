# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ Next.js here is **16.2.9** with breaking changes from older versions. Before writing
> Next.js code, read the relevant guide under `node_modules/next/dist/docs/`. Route
> `params`/`searchParams` are **async** — await them.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # eslint (flat config)
```

No test runner and no DB migration step exist — don't look for them.

## Gotchas & conventions

- **The schema lives in two places that must stay in sync.** `src/db/index.ts` creates tables
  from a `BOOTSTRAP_SQL` string (`CREATE TABLE IF NOT EXISTS`, run on first boot — there are no
  migrations). `src/db/schema.ts` is the typed Drizzle mirror. Change a column in one, change it
  in the other (snake_case in SQL, camelCase in Drizzle).
- **`better-sqlite3` is a native module:** server-only, and listed in `serverExternalPackages`
  (`next.config.ts`). Don't import it client-side. The DB file (`data/bodycraften.db`) is created
  and seeded automatically; the `db` instance is memoized on `globalThis` for dev hot-reload.
- **Reads vs. writes:** reads go in `src/lib/queries.ts` (`server-only`), writes in
  `src/lib/actions.ts` (`"use server"`). Every mutation calls `revalidatePath("/", "layout")`
  and returns `ActionResult<T>` (`{ ok: true, data }` | `{ ok: false, error }`) — callers branch
  on `.ok`, they don't throw. DB-backed pages set `export const dynamic = "force-dynamic"`.
- **Exercises are referenced by name (string), not foreign key** across workouts, plans, and the
  library. Logging upserts unknown names into the `exercises` table.
- **Progressive-overload + date math is centralized in `src/lib/overload.ts`** (Epley 1RM,
  volume, streaks). Dates are `yyyy-MM-dd` strings — use those helpers, not ad-hoc `Date`.
- **Both external integrations degrade gracefully when their key is absent** (`.env.local`):
  AI plan generation (`POST /api/generate`, Anthropic structured output via `zodOutputFormat`,
  model `claude-opus-4-8`) falls back to `src/lib/demo-plan.ts`; the ExerciseDB catalog
  (`src/lib/exercise-api.ts`) falls back to the built-in seed list.

Cross-boundary DTOs live in `src/lib/types.ts`; Drizzle row types in `src/db/schema.ts`.
shadcn/ui uses the **radix-nova** preset over the unified `radix-ui` package (see `components.json`).
