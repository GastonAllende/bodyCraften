import type {
  Plan,
  PlanDay,
  PlanExercise,
  ScheduleEntry,
  Workout,
  WorkoutSet,
} from "@/db/schema";

/** Exercise shape shared by the local library and the external API. */
export type LibraryExercise = {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
  source: "built-in" | "api" | "custom";
  /** Present when the exercise is saved in the local library. */
  id?: number;
  /** True when it comes from the external API and is not saved locally yet. */
  remote?: boolean;
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
  date: string;
  bestE1rm: number;
  topWeight: number;
  volume: number;
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
