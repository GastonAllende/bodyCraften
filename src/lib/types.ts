import type {
  BodyMeasurement,
  Plan,
  PlanDay,
  PlanExercise,
  ScheduleEntry,
  Workout,
  WorkoutSet,
} from "@/db/schema";

/** Exercise shape shared by the local library and the external API. */
export type LibraryExercise = {
  /**
   * Canonical English name. This is the join key — it is what gets written to
   * `workout_sets.exercise_name` / `plan_exercises.exercise_name`. Never store a
   * translated name here or a user's history splits when they switch language.
   */
  name: string;
  /** Localised label for display only; falls back to `name` when absent. */
  displayName?: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
  /** Catalog rows keep the individual steps so they can render as a list. */
  instructionSteps?: string[];
  source: "built-in" | "api" | "custom";
  /** Present when the exercise is saved in the local library. */
  id?: number;
  /** True when it comes from the catalog and is not saved locally yet. */
  remote?: boolean;
  /** Signed Storage URL for an owned row's photo/diagram; catalog rows never have one. */
  imageUrl?: string;
};

export type ExerciseInput = {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
  /** Storage object path, already uploaded client-side before the action runs. */
  imagePath?: string;
};

/**
 * Edit payload for an existing owned exercise. `name` is immutable — it is the
 * join key for `workout_sets`/`plan_exercises`, so renaming here would split
 * or orphan history. `imagePath` is tri-state, same convention as
 * `BodyEntryUpdateInput.photoPath`: `undefined` keeps it, `null` removes it, a
 * string replaces it.
 */
export type ExerciseUpdateInput = Omit<ExerciseInput, "name" | "imagePath"> & {
  imagePath?: string | null;
};

export type WorkoutPayload = {
  date: string;
  name: string;
  notes?: string;
  scheduleEntryId?: number;
  exercises: {
    name: string;
    sets: { weightKg: number; reps: number }[];
  }[];
};

export type PlanExerciseInput = {
  name: string;
  sets: number;
  reps: string;
  restSec?: number;
  notes?: string;
};

export type PlanInput = {
  name: string;
  description?: string;
  source: "manual" | "ai";
  days: { name: string; exercises: PlanExerciseInput[] }[];
};

/**
 * Edit payload for an existing plan. Days carry their id so the row survives
 * the update — dropping and recreating one would cascade-delete every schedule
 * entry pointing at it. A day without an id is new.
 */
export type PlanUpdateInput = {
  name: string;
  description?: string;
  days: { id?: number; name: string; exercises: PlanExerciseInput[] }[];
};

/** Shape returned by the AI generator (and its demo fallback). */
export type GeneratedPlan = {
  name: string;
  description: string;
  days: {
    name: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      restSec: number;
      notes: string;
    }[];
  }[];
};

export type PlanWithDays = Plan & {
  days: (PlanDay & { exercises: PlanExercise[] })[];
};

export type WorkoutWithSets = Workout & {
  sets: WorkoutSet[];
  volume: number;
  prCount: number;
};

export type ScheduleEntryView = ScheduleEntry & {
  planName?: string;
  exerciseCount?: number;
};

/** A scheduled plan day ready to prefill the workout logger. */
export type ScheduledDayPrefill = {
  entryId: number;
  label: string;
  exercises: PlanExerciseInput[];
};

/** Last logged sets per exercise — the progressive-overload hint. */
export type LastSessionHints = Record<
  string,
  { date: string; sets: { weightKg: number; reps: number }[] }
>;

export type ExerciseProgressPoint = {
  /**
   * `date#workoutId`. The chart's x-axis is categorical, so two sessions on the
   * same day would collapse onto one category and the tooltip would report the
   * first one for every point. This keeps each session distinct; the axis and
   * tooltip render the date half.
   */
  sessionKey: string;
  date: string;
  bestE1rm: number;
  topWeight: number;
  volume: number;
};

export type BodyEntryInput = {
  date: string;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  thighCm?: number;
  hipCm?: number;
  notes?: string;
  /** Storage object path, already uploaded client-side before the action runs. */
  photoPath?: string;
};

export type BodyEntryWithPhoto = BodyMeasurement & { photoUrl: string | null };

/**
 * Edit payload for an existing entry. `photoPath` is tri-state:
 * `undefined` keeps the current photo, `null` removes it, a string replaces it.
 */
export type BodyEntryUpdateInput = Omit<BodyEntryInput, "photoPath"> & {
  photoPath?: string | null;
};

export type DashboardData = {
  workoutsThisWeek: number;
  volumeThisWeek: number;
  volumeDeltaPct: number | null;
  streakDays: number;
  prsLast30Days: number;
  weeklyVolume: { week: string; volume: number }[];
  recentWorkouts: WorkoutWithSets[];
  todaysEntries: ScheduleEntryView[];
  trackedExercises: string[];
  progressByExercise: Record<string, ExerciseProgressPoint[]>;
};
