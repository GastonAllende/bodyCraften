import "server-only";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bodyMeasurements,
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
import { createClient } from "@/lib/supabase/server";
import { BODY_PHOTOS_BUCKET } from "@/lib/body-photos";
import type {
  BodyEntryWithPhoto,
  DashboardData,
  ExerciseProgressPoint,
  LastSessionHints,
  LibraryExercise,
  PlanWithDays,
  ScheduledDayPrefill,
  ScheduleEntryView,
  WorkoutWithSets,
} from "@/lib/types";

/**
 * Every function here takes `userId` and filters by it — that is the actual
 * security boundary. RLS is enabled on every table as defense-in-depth, but a
 * direct Drizzle connection over DATABASE_URL never goes through PostgREST,
 * so `auth.uid()` is NULL here and RLS has no effect on these queries. Don't
 * mistake RLS for "already handling it" — if a filter below is dropped, the
 * query leaks across users regardless of what RLS policies exist.
 */

async function loadWorkoutsWithSets(
  userId: string,
  limit?: number,
): Promise<WorkoutWithSets[]> {
  const db = getDb();
  const allWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date), desc(workouts.id));

  const workoutIds = allWorkouts.map((w) => w.id);
  const allSets = workoutIds.length
    ? await db
        .select()
        .from(workoutSets)
        .where(inArray(workoutSets.workoutId, workoutIds))
    : [];

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

async function scheduleViewsForDate(
  userId: string,
  date: string,
): Promise<ScheduleEntryView[]> {
  const db = getDb();
  const rows = await db
    .select({
      entry: scheduleEntries,
      dayName: planDays.name,
      planName: plans.name,
    })
    .from(scheduleEntries)
    .leftJoin(planDays, eq(scheduleEntries.planDayId, planDays.id))
    .leftJoin(plans, eq(planDays.planId, plans.id))
    .where(and(eq(scheduleEntries.date, date), eq(scheduleEntries.userId, userId)));

  return rows.map((r) => ({
    ...r.entry,
    planName: r.planName ?? undefined,
  }));
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const all = await loadWorkoutsWithSets(userId);
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
    todaysEntries: await scheduleViewsForDate(userId, todayIso()),
    trackedExercises,
    progressByExercise,
  };
}

/** Shared built-in catalog (`user_id IS NULL`) plus this user's own custom/imported rows. */
export async function getLibraryExercises(
  userId: string,
): Promise<LibraryExercise[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(exercises)
    .where(or(isNull(exercises.userId), eq(exercises.userId, userId)))
    .orderBy(asc(exercises.name));
  return rows.map((e) => ({
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
export async function getLastSessionHints(
  userId: string,
): Promise<LastSessionHints> {
  const db = getDb();
  const rows = await db
    .select({ set: workoutSets, date: workouts.date, workoutId: workouts.id })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.date), desc(workouts.id), asc(workoutSets.setNumber));

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
export async function getTodaysPrefills(
  userId: string,
): Promise<ScheduledDayPrefill[]> {
  const db = getDb();
  const entries = (
    await db
      .select()
      .from(scheduleEntries)
      .where(
        and(eq(scheduleEntries.date, todayIso()), eq(scheduleEntries.userId, userId)),
      )
  ).filter((e) => e.status === "planned");

  return Promise.all(
    entries.map(async (entry) => {
      let exercisesForDay: ScheduledDayPrefill["exercises"] = [];
      // Safe without a further ownership check: scheduleWorkout() only ever
      // sets planDayId to a day from one of this user's own plans.
      if (entry.planDayId != null) {
        exercisesForDay = (
          await db
            .select()
            .from(planExercises)
            .where(eq(planExercises.planDayId, entry.planDayId))
            .orderBy(asc(planExercises.position))
        ).map((pe) => ({
          name: pe.exerciseName,
          sets: pe.sets,
          reps: pe.reps,
          restSec: pe.restSec ?? undefined,
          notes: pe.notes ?? undefined,
        }));
      }
      return { entryId: entry.id, label: entry.label, exercises: exercisesForDay };
    }),
  );
}

export async function getWorkoutHistory(
  userId: string,
  limit = 30,
): Promise<WorkoutWithSets[]> {
  return loadWorkoutsWithSets(userId, limit);
}

/** How much logged data a history reset would remove. */
export async function getHistorySize(
  userId: string,
): Promise<{ workouts: number; sets: number }> {
  const db = getDb();
  const ownedWorkouts = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(eq(workouts.userId, userId));
  const workoutIds = ownedWorkouts.map((w) => w.id);
  const sets = workoutIds.length
    ? await db
        .select({ id: workoutSets.id })
        .from(workoutSets)
        .where(inArray(workoutSets.workoutId, workoutIds))
    : [];
  return { workouts: ownedWorkouts.length, sets: sets.length };
}

export async function getPlansWithDays(userId: string): Promise<PlanWithDays[]> {
  const db = getDb();
  const allPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.userId, userId))
    .orderBy(desc(plans.createdAt), desc(plans.id));

  const planIds = allPlans.map((p) => p.id);
  const allDays = planIds.length
    ? await db
        .select()
        .from(planDays)
        .where(inArray(planDays.planId, planIds))
        .orderBy(asc(planDays.position))
    : [];
  const dayIds = allDays.map((d) => d.id);
  const allExercises = dayIds.length
    ? await db
        .select()
        .from(planExercises)
        .where(inArray(planExercises.planDayId, dayIds))
        .orderBy(asc(planExercises.position))
    : [];

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
export async function getUpcomingSchedule(
  userId: string,
): Promise<{ date: string; entries: ScheduleEntryView[] }[]> {
  const db = getDb();
  const start = weekStart(new Date());
  const days: { date: string; entries: ScheduleEntryView[] }[] = [];

  const startIso = toIsoDate(start);
  const endIso = toIsoDate(addDays(start, 14));
  const rows = (
    await db
      .select({
        entry: scheduleEntries,
        planName: plans.name,
      })
      .from(scheduleEntries)
      .leftJoin(planDays, eq(scheduleEntries.planDayId, planDays.id))
      .leftJoin(plans, eq(planDays.planId, plans.id))
      .where(eq(scheduleEntries.userId, userId))
  ).filter((r) => r.entry.date >= startIso && r.entry.date < endIso);

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

/** Body-composition history, newest first, with signed URLs for any photos. */
export async function getBodyHistory(userId: string): Promise<BodyEntryWithPhoto[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.id));

  const supabase = await createClient();
  return Promise.all(
    rows.map(async (row) => {
      if (!row.photoPath) return { ...row, photoUrl: null };
      const { data } = await supabase.storage
        .from(BODY_PHOTOS_BUCKET)
        .createSignedUrl(row.photoPath, 3600);
      return { ...row, photoUrl: data?.signedUrl ?? null };
    }),
  );
}

export async function getExerciseCatalogMerged(
  userId: string,
): Promise<{ exercises: LibraryExercise[] }> {
  const catalog = getVendoredCatalog(await getLocale());
  const local = await getLibraryExercises(userId);

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
