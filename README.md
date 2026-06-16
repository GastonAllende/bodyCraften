# BodyCraften

Personal gym companion: log workouts, track progressive overload, build &
schedule plans, and generate plans from plain text with AI.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No configuration needed — a local SQLite database
is created at `data/bodycraften.db` on first run, pre-seeded with ~70 common
exercises.

## Pages

| Page | What it does |
| --- | --- |
| **Dashboard** | Weekly stats, training-volume chart, per-exercise strength curve (est. 1RM), recent sessions, today's scheduled workout. |
| **Log** | The workout logger. Shows *last session's weight × reps next to every set* so you always know what to beat. Detects PRs on save. Prefills from today's scheduled plan day. |
| **Plans** | Build multi-day plans, browse them, and schedule plan days on a 2-week calendar strip. |
| **Exercises** | Exercise library with search and body-part filters. Uses the ExerciseDB API when a key is set, otherwise the built-in catalog. Add custom exercises anytime. |
| **Generate** | Describe your training in plain words → structured weekly plan → save it as a plan. Uses Claude when `ANTHROPIC_API_KEY` is set; otherwise a local demo generator. |

## API keys (optional)

Copy `.env.example` to `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # real AI plan generation (https://platform.claude.com/)
EXERCISEDB_API_KEY=...         # 1,300+ exercise catalog (RapidAPI → ExerciseDB)
```

Restart the dev server after adding keys. Everything degrades gracefully
without them.

## Database

SQLite (file at `data/bodycraften.db`) through **Drizzle ORM** +
`better-sqlite3`. Zero-config, fast, and perfect for a single-user app. Schema
lives in `src/db/schema.ts`; tables are created automatically on first run.

Upgrade paths when you need them:

- **Turso (hosted libSQL)** — keep the same Drizzle schema, sync across
  devices.
- **Postgres / Supabase** — if the app ever becomes multi-user (auth, sharing).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui ·
Drizzle ORM + better-sqlite3 · Motion (Framer Motion) · Recharts ·
Anthropic SDK (structured outputs).
