import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema";

/**
 * Exercise library: built-in seed (`user_id IS NULL`, shared/global) + API
 * imports + user-created rows (`user_id` set, private to that user). Two
 * unique indexes keep the namespaces separate: the global catalog can't have
 * duplicate names, and each user can independently have their own row with a
 * name that collides with someone else's (or with a global row).
 */
export const exercises = pgTable(
  "exercises",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    userId: uuid("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    bodyPart: text("body_part").notNull(),
    equipment: text("equipment").notNull(),
    target: text("target").notNull(),
    instructions: text("instructions"),
    imagePath: text("image_path"), // Supabase Storage object path, not a public URL
    source: text("source").notNull().default("built-in"), // built-in | api | custom
  },
  (table) => [
    uniqueIndex("exercises_name_global_unique")
      .on(table.name)
      .where(sql`${table.userId} is null`),
    uniqueIndex("exercises_name_user_unique").on(table.name, table.userId),
  ],
);

/** A logged training session. */
export const workouts = pgTable(
  "workouts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // yyyy-MM-dd
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    // Matches queries.ts's `where(eq(userId, ...)).orderBy(desc(date), desc(id))`.
    index("workouts_user_id_date_id_idx").on(
      table.userId,
      table.date,
      table.id,
    ),
  ],
);

/** A single logged set. Scoped via its parent workout — no user_id here. */
export const workoutSets = pgTable(
  "workout_sets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseName: text("exercise_name").notNull(),
    exerciseOrder: integer("exercise_order").notNull().default(0),
    setNumber: integer("set_number").notNull(),
    weightKg: real("weight_kg").notNull(),
    reps: integer("reps").notNull(),
    isPr: boolean("is_pr").notNull().default(false),
  },
  (table) => [index("workout_sets_workout_id_idx").on(table.workoutId)],
);

/** A workout plan (manual or AI-generated). */
export const plans = pgTable(
  "plans",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    source: text("source").notNull().default("manual"), // manual | ai
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("plans_user_id_idx").on(table.userId)],
);

/** A day within a plan, e.g. "Push Day". Scoped via its parent plan. */
export const planDays = pgTable(
  "plan_days",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("plan_days_plan_id_idx").on(table.planId)],
);

/** Prescribed exercise within a plan day. Scoped via its parent plan day. */
export const planExercises = pgTable(
  "plan_exercises",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    planDayId: integer("plan_day_id")
      .notNull()
      .references(() => planDays.id, { onDelete: "cascade" }),
    exerciseName: text("exercise_name").notNull(),
    sets: integer("sets").notNull(),
    reps: text("reps").notNull(), // e.g. "8-12"
    restSec: integer("rest_sec"),
    position: integer("position").notNull().default(0),
    notes: text("notes"),
  },
  (table) => [index("plan_exercises_plan_day_id_idx").on(table.planDayId)],
);

/** A plan day placed on the calendar. */
export const scheduleEntries = pgTable(
  "schedule_entries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // yyyy-MM-dd
    planDayId: integer("plan_day_id").references(() => planDays.id, {
      onDelete: "cascade",
    }),
    label: text("label").notNull(),
    status: text("status").notNull().default("planned"), // planned | done | skipped
    workoutId: integer("workout_id").references(() => workouts.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // Matches scheduleViewsForDate's `where(eq(date, ...), eq(userId, ...))`.
    index("schedule_entries_user_id_date_idx").on(table.userId, table.date),
    index("schedule_entries_plan_day_id_idx").on(table.planDayId),
  ],
);

/** A body-composition check-in: measurements + optional progress photo. */
export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // yyyy-MM-dd
    heightCm: real("height_cm"),
    weightKg: real("weight_kg"),
    waistCm: real("waist_cm"),
    chestCm: real("chest_cm"),
    thighCm: real("thigh_cm"),
    hipCm: real("hip_cm"),
    photoPath: text("photo_path"), // Supabase Storage object path, not a public URL
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("body_measurements_user_id_date_idx").on(table.userId, table.date),
  ],
);

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanDay = typeof planDays.$inferSelect;
export type PlanExercise = typeof planExercises.$inferSelect;
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
