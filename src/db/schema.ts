import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/** Exercise library: built-in seed + API imports + user-created. */
export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  bodyPart: text("body_part").notNull(),
  equipment: text("equipment").notNull(),
  target: text("target").notNull(),
  instructions: text("instructions"),
  source: text("source").notNull().default("built-in"), // built-in | api | custom
});

/** A logged training session. */
export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // yyyy-MM-dd
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

/** A single logged set. */
export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  exerciseOrder: integer("exercise_order").notNull().default(0),
  setNumber: integer("set_number").notNull(),
  weightKg: real("weight_kg").notNull(),
  reps: integer("reps").notNull(),
  isPr: integer("is_pr", { mode: "boolean" }).notNull().default(false),
});

/** A workout plan (manual or AI-generated). */
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  source: text("source").notNull().default("manual"), // manual | ai
  createdAt: text("created_at").notNull(),
});

/** A day within a plan, e.g. "Push Day". */
export const planDays = sqliteTable("plan_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});

/** Prescribed exercise within a plan day. */
export const planExercises = sqliteTable("plan_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planDayId: integer("plan_day_id")
    .notNull()
    .references(() => planDays.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  sets: integer("sets").notNull(),
  reps: text("reps").notNull(), // e.g. "8-12"
  restSec: integer("rest_sec"),
  position: integer("position").notNull().default(0),
  notes: text("notes"),
});

/** A plan day placed on the calendar. */
export const scheduleEntries = sqliteTable("schedule_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // yyyy-MM-dd
  planDayId: integer("plan_day_id").references(() => planDays.id, {
    onDelete: "cascade",
  }),
  label: text("label").notNull(),
  status: text("status").notNull().default("planned"), // planned | done | skipped
  workoutId: integer("workout_id").references(() => workouts.id, {
    onDelete: "set null",
  }),
});

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanDay = typeof planDays.$inferSelect;
export type PlanExercise = typeof planExercises.$inferSelect;
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
