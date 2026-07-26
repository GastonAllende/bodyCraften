"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  planDays,
  planExercises,
  plans,
  scheduleEntries,
  workouts,
  workoutSets,
} from "@/db/schema";
import { findCanonical } from "@/lib/exercise-catalog";
import { fmt, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { estimateOneRepMax } from "@/lib/overload";
import { isValidRepRange } from "@/lib/validation";
import type {
  PlanExerciseInput,
  PlanInput,
  PlanUpdateInput,
  WorkoutPayload,
} from "@/lib/types";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function revalidateApp() {
  revalidatePath("/", "layout");
}

export async function setLocale(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.unsupportedLanguage };
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidateApp();
  return { ok: true };
}

export async function saveWorkout(
  payload: WorkoutPayload,
): Promise<ActionResult<{ workoutId: number; prExercises: string[] }>> {
  const cleanExercises = payload.exercises
    .map((e) => ({
      name: e.name.trim(),
      // Reps are a whole count; a zero, a fraction or a NaN from bad input is
      // not a set that happened, so it never reaches the database.
      sets: e.sets.filter(
        (s) =>
          Number.isInteger(s.reps) &&
          s.reps > 0 &&
          Number.isFinite(s.weightKg) &&
          s.weightKg >= 0,
      ),
    }))
    .filter((e) => e.name && e.sets.length > 0);

  if (cleanExercises.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.logAtLeastOneSet };
  }

  // Previous best estimated 1RM per exercise, for PR detection.
  const priorBest = new Map<string, number>();
  const history = db
    .select({ set: workoutSets })
    .from(workoutSets)
    .all();
  for (const { set } of history) {
    const e1rm = estimateOneRepMax(set.weightKg, set.reps);
    const prev = priorBest.get(set.exerciseName) ?? 0;
    if (e1rm > prev) priorBest.set(set.exerciseName, e1rm);
  }

  const [workout] = db
    .insert(workouts)
    .values({
      date: payload.date,
      name: payload.name.trim() || (await getDictionary()).common.workout,
      notes: payload.notes?.trim() || null,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .all();

  const prExercises: string[] = [];
  cleanExercises.forEach((exercise, exerciseOrder) => {
    const prior = priorBest.get(exercise.name) ?? 0;
    const bestNew = Math.max(
      ...exercise.sets.map((s) => estimateOneRepMax(s.weightKg, s.reps)),
    );
    const isPrSession = prior > 0 && bestNew > prior;
    if (isPrSession) prExercises.push(exercise.name);

    db.insert(workoutSets)
      .values(
        exercise.sets.map((set, i) => ({
          workoutId: workout.id,
          exerciseName: exercise.name,
          exerciseOrder,
          setNumber: i + 1,
          weightKg: set.weightKg,
          reps: set.reps,
          isPr:
            isPrSession &&
            estimateOneRepMax(set.weightKg, set.reps) === bestNew,
        })),
      )
      .run();

    // Make sure logged exercises exist in the library for future search.
    db.insert(exercises)
      .values({
        name: exercise.name,
        bodyPart: "other",
        equipment: "other",
        target: "other",
        source: "custom",
      })
      .onConflictDoNothing()
      .run();
  });

  if (payload.scheduleEntryId != null) {
    db.update(scheduleEntries)
      .set({ status: "done", workoutId: workout.id })
      .where(eq(scheduleEntries.id, payload.scheduleEntryId))
      .run();
  }

  revalidateApp();
  return { ok: true, data: { workoutId: workout.id, prExercises } };
}

export async function deleteWorkout(id: number): Promise<ActionResult> {
  db.delete(workouts).where(eq(workouts.id, id)).run();
  revalidateApp();
  return { ok: true };
}

/**
 * Wipes every logged session so the user can start from zero. Sets go with the
 * workouts via cascade. Plans, the calendar and the exercise library are left
 * alone — this is a history reset, not a factory reset.
 */
export async function resetWorkoutHistory(): Promise<
  ActionResult<{ deleted: number }>
> {
  const deleted = db.delete(workouts).returning({ id: workouts.id }).all();
  revalidateApp();
  return { ok: true, data: { deleted: deleted.length } };
}

export async function addCustomExercise(input: {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.giveExerciseName };
  }
  const inserted = db
    .insert(exercises)
    .values({
      name,
      bodyPart: input.bodyPart.trim() || "other",
      equipment: input.equipment.trim() || "other",
      target: input.target.trim() || "other",
      source: "custom",
    })
    .onConflictDoNothing()
    .returning()
    .all();
  if (inserted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: fmt(t.actions.alreadyInLibrary, { name }) };
  }
  revalidateApp();
  return { ok: true };
}

/** Saves an exercise coming from the external API into the local library. */
export async function importExercise(input: {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
}): Promise<ActionResult> {
  // The client sends whatever it rendered, which is localised. Prefer the
  // catalog's canonical English facets so the stored row reads correctly in
  // every locale; fall back to the input for exercises we don't recognise.
  const canonical = findCanonical(input.name);

  db.insert(exercises)
    .values({
      name: input.name,
      bodyPart: canonical?.bodyPart ?? input.bodyPart,
      equipment: canonical?.equipment ?? input.equipment,
      target: canonical?.target ?? input.target,
      instructions:
        canonical?.instructions ?? input.instructions?.trim() ?? null,
      source: "api",
    })
    .onConflictDoNothing()
    .run();
  revalidateApp();
  return { ok: true };
}

/**
 * Removes an exercise from the local library. Exercises are referenced by name,
 * not by foreign key, so logged sets and plan entries keep working — the row
 * only disappears from the library and from the logger's search.
 */
export async function removeExercise(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  const deleted = db
    .delete(exercises)
    .where(eq(exercises.name, trimmed))
    .returning()
    .all();
  if (deleted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: fmt(t.actions.notInLibrary, { name: trimmed }) };
  }
  revalidateApp();
  return { ok: true };
}

/**
 * Sets must be a whole number of 1 or more; reps must be a positive count or
 * range ("8", "8-12"). The client blocks bad values as they are typed, but a
 * server action is a public endpoint, so it is re-checked here.
 */
function findNumberError(
  days: { exercises: PlanExerciseInput[] }[],
): "sets" | "reps" | null {
  for (const day of days) {
    for (const e of day.exercises) {
      if (!Number.isInteger(e.sets) || e.sets < 1) return "sets";
      if (!isValidRepRange(e.reps)) return "reps";
    }
  }
  return null;
}

function writePlanExercises(planDayId: number, list: PlanExerciseInput[]) {
  db.insert(planExercises)
    .values(
      list.map((e, i) => ({
        planDayId,
        exerciseName: e.name.trim(),
        sets: e.sets,
        reps: e.reps.trim(),
        restSec: e.restSec ?? null,
        position: i,
        notes: e.notes?.trim() || null,
      })),
    )
    .run();
}

export async function createPlan(
  input: PlanInput,
): Promise<ActionResult<{ planId: number }>> {
  const t = await getDictionary();
  const name = input.name.trim();
  if (!name) return { ok: false, error: t.actions.givePlanName };
  const days = input.days
    .map((d) => ({
      name: d.name.trim() || t.actions.trainingDay,
      exercises: d.exercises.filter((e) => e.name.trim()),
    }))
    .filter((d) => d.exercises.length > 0);
  if (days.length === 0) {
    return { ok: false, error: t.actions.addAtLeastOneDay };
  }
  const numberError = findNumberError(days);
  if (numberError) {
    return {
      ok: false,
      error:
        numberError === "sets" ? t.actions.invalidSets : t.actions.invalidReps,
    };
  }

  const [plan] = db
    .insert(plans)
    .values({
      name,
      description: input.description?.trim() || null,
      source: input.source,
      createdAt: new Date().toISOString(),
    })
    .returning()
    .all();

  days.forEach((day, dayIndex) => {
    const [createdDay] = db
      .insert(planDays)
      .values({ planId: plan.id, name: day.name, position: dayIndex })
      .returning()
      .all();
    writePlanExercises(createdDay.id, day.exercises);
  });

  revalidateApp();
  return { ok: true, data: { planId: plan.id } };
}

/**
 * Rewrites a plan in place. Days that keep their id are updated rather than
 * recreated, so scheduled entries pointing at them stay on the calendar;
 * removing a day from the plan does cascade its schedule entries away.
 */
export async function updatePlan(
  id: number,
  input: PlanUpdateInput,
): Promise<ActionResult> {
  const t = await getDictionary();
  const name = input.name.trim();
  if (!name) return { ok: false, error: t.actions.givePlanName };
  const days = input.days
    .map((d) => ({
      id: d.id,
      name: d.name.trim() || t.actions.trainingDay,
      exercises: d.exercises.filter((e) => e.name.trim()),
    }))
    .filter((d) => d.exercises.length > 0);
  if (days.length === 0) {
    return { ok: false, error: t.actions.addAtLeastOneDay };
  }
  const numberError = findNumberError(days);
  if (numberError) {
    return {
      ok: false,
      error:
        numberError === "sets" ? t.actions.invalidSets : t.actions.invalidReps,
    };
  }

  const [existing] = db.select().from(plans).where(eq(plans.id, id)).all();
  if (!existing) return { ok: false, error: t.actions.planNotFound };

  db.update(plans)
    .set({ name, description: input.description?.trim() || null })
    .where(eq(plans.id, id))
    .run();

  const existingDayIds = new Set(
    db
      .select({ id: planDays.id })
      .from(planDays)
      .where(eq(planDays.planId, id))
      .all()
      .map((d) => d.id),
  );
  const keptDayIds = new Set<number>();

  days.forEach((day, dayIndex) => {
    let dayId = day.id != null && existingDayIds.has(day.id) ? day.id : null;
    if (dayId != null) {
      db.update(planDays)
        .set({ name: day.name, position: dayIndex })
        .where(eq(planDays.id, dayId))
        .run();
      // Nothing references plan_exercises, so replacing the whole list is safe.
      db.delete(planExercises).where(eq(planExercises.planDayId, dayId)).run();
    } else {
      const [createdDay] = db
        .insert(planDays)
        .values({ planId: id, name: day.name, position: dayIndex })
        .returning()
        .all();
      dayId = createdDay.id;
    }
    keptDayIds.add(dayId);
    writePlanExercises(dayId, day.exercises);
  });

  for (const dayId of existingDayIds) {
    if (!keptDayIds.has(dayId)) {
      db.delete(planDays).where(eq(planDays.id, dayId)).run();
    }
  }

  revalidateApp();
  return { ok: true };
}

export async function deletePlan(id: number): Promise<ActionResult> {
  db.delete(plans).where(eq(plans.id, id)).run();
  revalidateApp();
  return { ok: true };
}

export async function scheduleWorkout(input: {
  date: string;
  planDayId: number | null;
  label: string;
}): Promise<ActionResult> {
  const t = await getDictionary();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: t.actions.pickDateFirst };
  }
  const label = input.label.trim() || t.common.workout;
  db.insert(scheduleEntries)
    .values({
      date: input.date,
      planDayId: input.planDayId,
      label,
      status: "planned",
    })
    .run();
  revalidateApp();
  return { ok: true };
}

export async function updateScheduleStatus(
  id: number,
  status: "planned" | "done" | "skipped",
): Promise<ActionResult> {
  db.update(scheduleEntries)
    .set({ status })
    .where(eq(scheduleEntries.id, id))
    .run();
  revalidateApp();
  return { ok: true };
}

export async function deleteScheduleEntry(id: number): Promise<ActionResult> {
  db.delete(scheduleEntries).where(eq(scheduleEntries.id, id)).run();
  revalidateApp();
  return { ok: true };
}

/** Most recent workout id — used to deep-link after saving. */
export async function getLatestWorkoutId(): Promise<number | null> {
  const [latest] = db
    .select({ id: workouts.id })
    .from(workouts)
    .orderBy(desc(workouts.id))
    .limit(1)
    .all();
  return latest?.id ?? null;
}
