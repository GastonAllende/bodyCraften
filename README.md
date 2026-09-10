# BodyCraften

Multi-user gym companion: log workouts, track progressive overload, build &
schedule plans, and generate plans from plain text with AI.

## Quick start

Requires a Supabase project (Postgres + Auth) — there's no local/file
database.

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Postgres vars, see below
npm run db:migrate           # apply schema via drizzle-kit
npm run db:seed              # one-time: seed the built-in exercise catalog
npm run dev
```

Open http://localhost:3000. Sign up with email/password (Supabase Auth
handles verification and password reset).

## Pages

| Page | What it does |
| --- | --- |
| **Dashboard** | Weekly stats, training-volume chart, per-exercise strength curve (est. 1RM), recent sessions, today's scheduled workout. |
| **Log** | The workout logger. Shows *last session's weight × reps next to every set* so you always know what to beat. Detects PRs on save. Prefills from today's scheduled plan day. |
| **Plans** | Build multi-day plans, browse them, and schedule plan days on a 2-week calendar strip. |
| **Exercises** | Exercise library with search and body-part filters over a vendored 1,300-exercise catalog (English + Spanish, no API key needed). Opening an exercise shows step-by-step instructions. Add custom exercises anytime. |
| **Generate** | Describe your training in plain words → structured weekly plan → save it as a plan. Uses Claude when `ANTHROPIC_API_KEY` is set; otherwise a local demo generator. |
| **Settings** | Language (English/Spanish) and account settings. |

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
# Required — the app has no database without these
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=       # pooled, port 6543 — used by the app at runtime
DIRECT_URL=         # direct, port 5432 — used only by drizzle-kit

# Optional
ANTHROPIC_API_KEY=  # real AI plan generation (https://platform.claude.com/)
WORKOUTX_API_KEY=   # only needed to re-sync src/db/exercises*.json
```

Restart the dev server after adding keys. AI generation and the exercise
catalog re-sync both degrade gracefully without their keys.

## Database

Supabase Postgres through **Drizzle ORM**. Schema lives in `src/db/schema.ts`
(plus a stub `auth-schema.ts` for Supabase's `auth.users`); changes go through
drizzle-kit migrations (`npm run db:generate` then `npm run db:migrate`), not
an implicit bootstrap. The built-in exercise catalog is seeded once via
`npm run db:seed`. Row Level Security is enabled on every table
(`supabase/rls.sql`) as defense-in-depth — the app's own `user_id` filtering
in `src/lib/queries.ts`/`src/lib/actions.ts` is the actual access boundary.

## Stack

Next.js 16 (App Router) · TypeScript · Supabase (Auth + Postgres) ·
Tailwind CSS v4 · shadcn/ui · Drizzle ORM · Motion (Framer Motion) ·
Recharts · Anthropic SDK (structured outputs).
