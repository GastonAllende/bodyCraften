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
import { fmt, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { estimateOneRepMax } from "@/lib/overload";
import type { PlanInput, WorkoutPayload } from "@/lib/types";

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
      sets: e.sets.filter((s) => s.reps > 0 && s.weightKg >= 0),
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
  db.insert(exercises)
    .values({
      name: input.name,
      bodyPart: input.bodyPart,
      equipment: input.equipment,
      target: input.target,
      instructions: input.instructions ?? null,
      source: "api",
    })
    .onConflictDoNothing()
    .run();
  revalidateApp();
  return { ok: true };
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
    db.insert(planExercises)
      .values(
        day.exercises.map((e, i) => ({
          planDayId: createdDay.id,
          exerciseName: e.name.trim(),
          sets: Math.max(1, Math.round(e.sets)),
          reps: e.reps.trim() || "8-12",
          restSec: e.restSec ?? null,
          position: i,
          notes: e.notes?.trim() || null,
        })),
      )
      .run();
  });

  revalidateApp();
  return { ok: true, data: { planId: plan.id } };
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
