import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SEED_EXERCISES } from "./seed-exercises";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bodycraften.db");

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  body_part TEXT NOT NULL,
  equipment TEXT NOT NULL,
  target TEXT NOT NULL,
  instructions TEXT,
  source TEXT NOT NULL DEFAULT 'built-in'
);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL DEFAULT 0,
  set_number INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  is_pr INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plan_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plan_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_day_id INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps TEXT NOT NULL,
  rest_sec INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS schedule_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  plan_day_id INTEGER REFERENCES plan_days(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_name);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_entries(date);
`;

function createDb(): BetterSQLite3Database<typeof schema> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(BOOTSTRAP_SQL);

  const count = sqlite
    .prepare("SELECT COUNT(*) AS n FROM exercises")
    .get() as { n: number };
  if (count.n === 0) {
    const insert = sqlite.prepare(
      "INSERT OR IGNORE INTO exercises (name, body_part, equipment, target, source) VALUES (?, ?, ?, ?, 'built-in')",
    );
    const seedAll = sqlite.transaction(() => {
      for (const e of SEED_EXERCISES) {
        insert.run(e.name, e.bodyPart, e.equipment, e.target);
      }
    });
    seedAll();
  }

  return drizzle(sqlite, { schema });
}

// Reuse the connection across Next.js dev hot reloads.
const globalForDb = globalThis as unknown as {
  bodycraftenDb?: BetterSQLite3Database<typeof schema>;
};

export const db = globalForDb.bodycraftenDb ?? createDb();
globalForDb.bodycraftenDb = db;
