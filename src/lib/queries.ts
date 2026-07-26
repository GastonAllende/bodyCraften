import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  planDays,
  planExercises,
  plans,
  scheduleEntries,
  workouts,
  workoutSets,
  type PlanDay,
  type Workout,
  type WorkoutSet,
} from "@/db/schema";
import { getVendoredCatalog } from "@/lib/exercise-catalog";
import { getLocale } from "@/lib/i18n/server";
import {
  addDays,
  computeStreak,
  estimateOneRepMax,
  setVolume,
  toIsoDate,
  todayIso,
  weekStart,
} from "@/lib/overload";
import type {
  DashboardData,
  ExerciseProgressPoint,
  LastSessionHints,
  LibraryExercise,
  PlanWithDays,
  ScheduledDayPrefill,
  ScheduleEntryView,
  WorkoutWithSets,
} from "@/lib/types";

function loadWorkoutsWithSets(limit?: number): WorkoutWithSets[] {
  const allWorkouts = db
    .select()
    .from(workouts)
    .orderBy(desc(workouts.date), desc(workouts.id))
    .all();
  const allSets = db.select().from(workoutSets).all();

  const byWorkout = new Map<number, WorkoutSet[]>();
  for (const set of allSets) {
    const list = byWorkout.get(set.workoutId) ?? [];
    list.push(set);
    byWorkout.set(set.workoutId, list);
  }

  const result = allWorkouts.map((w: Workout) => {
    const sets = (byWorkout.get(w.id) ?? []).sort(
      (a, b) => a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber,
    );
    return {
      ...w,
      sets,
      volume: sets.reduce((sum, s) => sum + setVolume(s.weightKg, s.reps), 0),
      prCount: sets.filter((s) => s.isPr).length,
    };
  });

  return limit ? result.slice(0, limit) : result;
}

function scheduleViewsForDate(date: string): ScheduleEntryView[] {
  const rows = db
    .select({
      entry: scheduleEntries,
      dayName: planDays.name,
      planName: plans.name,
    })
    .from(scheduleEntries)
    .leftJoin(planDays, eq(scheduleEntries.planDayId, planDays.id))
    .leftJoin(plans, eq(planDays.planId, plans.id))
    .where(eq(scheduleEntries.date, date))
    .all();

  return rows.map((r) => ({
    ...r.entry,
    planName: r.planName ?? undefined,
  }));
}

export function getDashboardData(): DashboardData {
  const all = loadWorkoutsWithSets();
  const today = new Date();
  const thisWeekStart = weekStart(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisWeekIso = toIsoDate(thisWeekStart);
  const lastWeekIso = toIsoDate(lastWeekStart);

  const thisWeek = all.filter((w) => w.date >= thisWeekIso);
  const lastWeek = all.filter(
    (w) => w.date >= lastWeekIso && w.date < thisWeekIso,
  );
  const volumeThisWeek = thisWeek.reduce((s, w) => s + w.volume, 0);
  const volumeLastWeek = lastWeek.reduce((s, w) => s + w.volume, 0);

  const monthAgoIso = toIsoDate(addDays(today, -30));
  const prsLast30Days = all
    .filter((w) => w.date >= monthAgoIso)
    .reduce((s, w) => s + w.prCount, 0);

  // Volume per week for the last 10 weeks.
  const weeklyVolume: { week: string; volume: number }[] = [];
  for (let i = 9; i >= 0; i--) {
    const start = addDays(thisWeekStart, -7 * i);
    const end = addDays(start, 7);
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    const volume = all
      .filter((w) => w.date >= startIso && w.date < endIso)
      .reduce((s, w) => s + w.volume, 0);
    weeklyVolume.push({
      week: start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      volume: Math.round(volume),
    });
  }

  // Most-trained exercises and their per-session progress.
  const sessionsPerExercise = new Map<string, number>();
  for (const w of all) {
    for (const name of new Set(w.sets.map((s) => s.exerciseName))) {
      sessionsPerExercise.set(name, (sessionsPerExercise.get(name) ?? 0) + 1);
    }
  }
  const trackedExercises = [...sessionsPerExercise.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  const progressByExercise: Record<string, ExerciseProgressPoint[]> = {};
  for (const name of trackedExercises) {
    const points: ExerciseProgressPoint[] = [];
    for (const w of [...all].reverse()) {
      const sets = w.sets.filter((s) => s.exerciseName === name);
      if (sets.length === 0) continue;
      points.push({
        sessionKey: `${w.date}#${w.id}`,
        date: w.date,
        bestE1rm:
          Math.round(
            Math.max(...sets.map((s) => estimateOneRepMax(s.weightKg, s.reps))) * 10,
          ) / 10,
        topWeight: Math.max(...sets.map((s) => s.weightKg)),
        volume: Math.round(
          sets.reduce((sum, s) => sum + setVolume(s.weightKg, s.reps), 0),
        ),
      });
    }
    progressByExercise[name] = points.slice(-20);
  }

  return {
    workoutsThisWeek: thisWeek.length,
    volumeThisWeek: Math.round(volumeThisWeek),
    volumeDeltaPct:
      volumeLastWeek > 0
        ? Math.round(((volumeThisWeek - volumeLastWeek) / volumeLastWeek) * 100)
        : null,
    streakDays: computeStreak(all.map((w) => w.date)),
    prsLast30Days,
    weeklyVolume,
    recentWorkouts: all.slice(0, 5),
    todaysEntries: scheduleViewsForDate(todayIso()),
    trackedExercises,
    progressByExercise,
  };
}

export function getLibraryExercises(): LibraryExercise[] {
  return db
    .select()
    .from(exercises)
    .orderBy(asc(exercises.name))
    .all()
    .map((e) => ({
      id: e.id,
      name: e.name,
      bodyPart: e.bodyPart,
      equipment: e.equipment,
      target: e.target,
      instructions: e.instructions ?? undefined,
      source: e.source as LibraryExercise["source"],
    }));
}

/** Latest logged session per exercise — powers "last time" hints in the logger. */
export function getLastSessionHints(): LastSessionHints {
  const rows = db
    .select({ set: workoutSets, date: workouts.date, workoutId: workouts.id })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .orderBy(desc(workouts.date), desc(workouts.id), asc(workoutSets.setNumber))
    .all();

  const hints: LastSessionHints = {};
  // Rows arrive newest-first, so the first one seen for an exercise belongs to
  // its most recent session. Keep that workout's id and accept only more rows
  // from it — matching on date instead would merge every session logged on the
  // same day, which made the hint (and the logger's prefilled set count) grow
  // every time the exercise was logged again.
  const sourceWorkout = new Map<string, number>();
  for (const row of rows) {
    const name = row.set.exerciseName;
    const set = { weightKg: row.set.weightKg, reps: row.set.reps };
    const existing = hints[name];
    if (!existing) {
      hints[name] = { date: row.date, sets: [set] };
      sourceWorkout.set(name, row.workoutId);
    } else if (sourceWorkout.get(name) === row.workoutId) {
      existing.sets.push(set);
    }
  }
  return hints;
}

/** Today's planned (not yet completed) schedule entries, with exercises for prefill. */
export function getTodaysPrefills(): ScheduledDayPrefill[] {
  const entries = db
    .select()
    .from(scheduleEntries)
    .where(eq(scheduleEntries.date, todayIso()))
    .all()
    .filter((e) => e.status === "planned");

  return entries.map((entry) => {
    let exercisesForDay: ScheduledDayPrefill["exercises"] = [];
    if (entry.planDayId != null) {
      exercisesForDay = db
        .select()
        .from(planExercises)
        .where(eq(planExercises.planDayId, entry.planDayId))
        .orderBy(asc(planExercises.position))
        .all()
        .map((pe) => ({
          name: pe.exerciseName,
          sets: pe.sets,
          reps: pe.reps,
          restSec: pe.restSec ?? undefined,
          notes: pe.notes ?? undefined,
        }));
    }
    return { entryId: entry.id, label: entry.label, exercises: exercisesForDay };
  });
}

export function getWorkoutHistory(limit = 30): WorkoutWithSets[] {
  return loadWorkoutsWithSets(limit);
}

/** How much logged data a history reset would remove. */
export function getHistorySize(): { workouts: number; sets: number } {
  return {
    workouts: db.select({ id: workouts.id }).from(workouts).all().length,
    sets: db.select({ id: workoutSets.id }).from(workoutSets).all().length,
  };
}

export function getPlansWithDays(): PlanWithDays[] {
  const allPlans = db
    .select()
    .from(plans)
    .orderBy(desc(plans.createdAt), desc(plans.id))
    .all();
  const allDays = db
    .select()
    .from(planDays)
    .orderBy(asc(planDays.position))
    .all();
  const allExercises = db
    .select()
    .from(planExercises)
    .orderBy(asc(planExercises.position))
    .all();

  return allPlans.map((plan) => ({
    ...plan,
    days: allDays
      .filter((d: PlanDay) => d.planId === plan.id)
      .map((d) => ({
        ...d,
        exercises: allExercises.filter((pe) => pe.planDayId === d.id),
      })),
  }));
}

/** Schedule for the current week and the next one. */
export function getUpcomingSchedule(): {
  date: string;
  entries: ScheduleEntryView[];
}[] {
  const start = weekStart(new Date());
  const days: { date: string; entries: ScheduleEntryView[] }[] = [];

  const startIso = toIsoDate(start);
  const endIso = toIsoDate(addDays(start, 14));
  const rows = db
    .select({
      entry: scheduleEntries,
      planName: plans.name,
    })
    .from(scheduleEntries)
    .leftJoin(planDays, eq(scheduleEntries.planDayId, planDays.id))
    .leftJoin(plans, eq(planDays.planId, plans.id))
    .all()
    .filter((r) => r.entry.date >= startIso && r.entry.date < endIso);

  for (let i = 0; i < 14; i++) {
    const date = toIsoDate(addDays(start, i));
    days.push({
      date,
      entries: rows
        .filter((r) => r.entry.date === date)
        .map((r) => ({ ...r.entry, planName: r.planName ?? undefined })),
    });
  }
  return days;
}

export async function getExerciseCatalogMerged(): Promise<{
  exercises: LibraryExercise[];
}> {
  const catalog = getVendoredCatalog(await getLocale());
  const local = getLibraryExercises();

  const merged = new Map<string, LibraryExercise>();
  for (const e of catalog) {
    merged.set(e.name.toLowerCase(), e);
  }
  // Local entries win on identity (they carry the row id and may be custom),
  // but a saved row stores one fixed language, so every displayed field comes
  // from the catalog when the name matches.
  for (const e of local) {
    const key = e.name.toLowerCase();
    const fromCatalog = merged.get(key);
    merged.set(key, {
      ...e,
      displayName: fromCatalog?.displayName,
      bodyPart: fromCatalog?.bodyPart ?? e.bodyPart,
      equipment: fromCatalog?.equipment ?? e.equipment,
      target: fromCatalog?.target ?? e.target,
      instructions: fromCatalog?.instructions ?? e.instructions,
      instructionSteps: fromCatalog?.instructionSteps,
    });
  }

  return {
    exercises: [...merged.values()].sort((a, b) =>
      (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name),
    ),
  };
}
