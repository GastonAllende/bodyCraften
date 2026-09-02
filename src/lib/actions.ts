"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
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
} from "@/db/schema";
import { getUser } from "@/lib/auth";
import { BODY_PHOTOS_BUCKET } from "@/lib/body-photos";
import { findCanonical } from "@/lib/exercise-catalog";
import { fmt, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { estimateOneRepMax } from "@/lib/overload";
import { createClient } from "@/lib/supabase/server";
import { isPositiveDecimal, isValidRepRange } from "@/lib/validation";
import type {
  BodyEntryInput,
  BodyEntryUpdateInput,
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

/**
 * Every mutating action below calls this first, independent of whatever the
 * proxy already checked (src/proxy.ts) — a matcher change there could
 * silently stop covering a route without this check ever failing loudly.
 */
async function requireUser() {
  const user = await getUser();
  if (!user) {
    const t = await getDictionary();
    return { user: null, error: t.actions.mustSignIn } as const;
  }
  return { user, error: null } as const;
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
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();

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

  // Previous best estimated 1RM per exercise, for PR detection — scoped to
  // this user's own history only, otherwise a PR badge could be computed
  // against (and leak) a different user's lifts.
  const priorBest = new Map<string, number>();
  const history = await db
    .select({ set: workoutSets })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(eq(workouts.userId, user.id));
  for (const { set } of history) {
    const e1rm = estimateOneRepMax(set.weightKg, set.reps);
    const prev = priorBest.get(set.exerciseName) ?? 0;
    if (e1rm > prev) priorBest.set(set.exerciseName, e1rm);
  }

  const [workout] = await db
    .insert(workouts)
    .values({
      userId: user.id,
      date: payload.date,
      name: payload.name.trim() || (await getDictionary()).common.workout,
      notes: payload.notes?.trim() || null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  const prExercises: string[] = [];
  for (const [exerciseOrder, exercise] of cleanExercises.entries()) {
    const prior = priorBest.get(exercise.name) ?? 0;
    const bestNew = Math.max(
      ...exercise.sets.map((s) => estimateOneRepMax(s.weightKg, s.reps)),
    );
    const isPrSession = prior > 0 && bestNew > prior;
    if (isPrSession) prExercises.push(exercise.name);

    await db.insert(workoutSets).values(
      exercise.sets.map((set, i) => ({
        workoutId: workout.id,
        exerciseName: exercise.name,
        exerciseOrder,
        setNumber: i + 1,
        weightKg: set.weightKg,
        reps: set.reps,
        isPr:
          isPrSession && estimateOneRepMax(set.weightKg, set.reps) === bestNew,
      })),
    );

    // Make sure logged exercises exist in this user's library for future search.
    await db
      .insert(exercises)
      .values({
        name: exercise.name,
        userId: user.id,
        bodyPart: "other",
        equipment: "other",
        target: "other",
        source: "custom",
      })
      .onConflictDoNothing({ target: [exercises.name, exercises.userId] });
  }

  if (payload.scheduleEntryId != null) {
    await db
      .update(scheduleEntries)
      .set({ status: "done", workoutId: workout.id })
      .where(
        and(
          eq(scheduleEntries.id, payload.scheduleEntryId),
          eq(scheduleEntries.userId, user.id),
        ),
      );
  }

  revalidateApp();
  return { ok: true, data: { workoutId: workout.id, prExercises } };
}

export async function deleteWorkout(id: number): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const deleted = await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, user.id)))
    .returning({ id: workouts.id });
  if (deleted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.notFound };
  }
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
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const deleted = await db
    .delete(workouts)
    .where(eq(workouts.userId, user.id))
    .returning({ id: workouts.id });
  revalidateApp();
  return { ok: true, data: { deleted: deleted.length } };
}

export async function addCustomExercise(input: {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
}): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 2) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.giveExerciseName };
  }
  const inserted = await db
    .insert(exercises)
    .values({
      name,
      userId: user.id,
      bodyPart: input.bodyPart.trim() || "other",
      equipment: input.equipment.trim() || "other",
      target: input.target.trim() || "other",
      source: "custom",
    })
    .onConflictDoNothing({ target: [exercises.name, exercises.userId] })
    .returning();
  if (inserted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: fmt(t.actions.alreadyInLibrary, { name }) };
  }
  revalidateApp();
  return { ok: true };
}

/** Saves an exercise coming from the external API into the user's own library. */
export async function importExercise(input: {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
}): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();

  // The client sends whatever it rendered, which is localised. Prefer the
  // catalog's canonical English facets so the stored row reads correctly in
  // every locale; fall back to the input for exercises we don't recognise.
  const canonical = findCanonical(input.name);

  await db
    .insert(exercises)
    .values({
      name: input.name,
      userId: user.id,
      bodyPart: canonical?.bodyPart ?? input.bodyPart,
      equipment: canonical?.equipment ?? input.equipment,
      target: canonical?.target ?? input.target,
      instructions:
        canonical?.instructions ?? input.instructions?.trim() ?? null,
      source: "api",
    })
    .onConflictDoNothing({ target: [exercises.name, exercises.userId] });
  revalidateApp();
  return { ok: true };
}

/**
 * Removes an exercise from this user's own library. Exercises are referenced
 * by name, not by foreign key, so logged sets and plan entries keep working —
 * the row only disappears from the library and from the logger's search.
 * Scoped to `userId` so this can never delete the shared/global catalog rows.
 */
export async function removeExercise(name: string): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const trimmed = name.trim();
  const deleted = await db
    .delete(exercises)
    .where(and(eq(exercises.name, trimmed), eq(exercises.userId, user.id)))
    .returning();
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

async function writePlanExercises(
  planDayId: number,
  list: PlanExerciseInput[],
) {
  const db = getDb();
  await db.insert(planExercises).values(
    list.map((e, i) => ({
      planDayId,
      exerciseName: e.name.trim(),
      sets: e.sets,
      reps: e.reps.trim(),
      restSec: e.restSec ?? null,
      position: i,
      notes: e.notes?.trim() || null,
    })),
  );
}

export async function createPlan(
  input: PlanInput,
): Promise<ActionResult<{ planId: number }>> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
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

  const [plan] = await db
    .insert(plans)
    .values({
      userId: user.id,
      name,
      description: input.description?.trim() || null,
      source: input.source,
      createdAt: new Date().toISOString(),
    })
    .returning();

  for (const [dayIndex, day] of days.entries()) {
    const [createdDay] = await db
      .insert(planDays)
      .values({ planId: plan.id, name: day.name, position: dayIndex })
      .returning();
    await writePlanExercises(createdDay.id, day.exercises);
  }

  revalidateApp();
  return { ok: true, data: { planId: plan.id } };
}

/**
 * Rewrites a plan in place. Days that keep their id are updated rather than
 * recreated, so scheduled entries pointing at them stay on the calendar;
 * removing a day from the plan does cascade its schedule entries away.
 *
 * Ownership is checked once, on the initial `plans` lookup below — every
 * write after that point is safe purely because that check gates them.
 * `planDays`/`planExercises` have no `user_id` of their own (see schema.ts),
 * so do not add per-write filters here; add the check instead if a new write
 * path into this function is ever introduced.
 */
export async function updatePlan(
  id: number,
  input: PlanUpdateInput,
): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
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

  const [existing] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, id), eq(plans.userId, user.id)));
  if (!existing) return { ok: false, error: t.actions.planNotFound };

  await db
    .update(plans)
    .set({ name, description: input.description?.trim() || null })
    .where(eq(plans.id, id));

  const existingDayIds = new Set(
    (
      await db
        .select({ id: planDays.id })
        .from(planDays)
        .where(eq(planDays.planId, id))
    ).map((d) => d.id),
  );
  const keptDayIds = new Set<number>();

  for (const [dayIndex, day] of days.entries()) {
    let dayId = day.id != null && existingDayIds.has(day.id) ? day.id : null;
    if (dayId != null) {
      await db
        .update(planDays)
        .set({ name: day.name, position: dayIndex })
        .where(eq(planDays.id, dayId));
      // Nothing references plan_exercises, so replacing the whole list is safe.
      await db.delete(planExercises).where(eq(planExercises.planDayId, dayId));
    } else {
      const [createdDay] = await db
        .insert(planDays)
        .values({ planId: id, name: day.name, position: dayIndex })
        .returning();
      dayId = createdDay.id;
    }
    keptDayIds.add(dayId);
    await writePlanExercises(dayId, day.exercises);
  }

  for (const dayId of existingDayIds) {
    if (!keptDayIds.has(dayId)) {
      await db.delete(planDays).where(eq(planDays.id, dayId));
    }
  }

  revalidateApp();
  return { ok: true };
}

export async function deletePlan(id: number): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const deleted = await db
    .delete(plans)
    .where(and(eq(plans.id, id), eq(plans.userId, user.id)))
    .returning({ id: plans.id });
  if (deleted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.notFound };
  }
  revalidateApp();
  return { ok: true };
}

export async function scheduleWorkout(input: {
  date: string;
  planDayId: number | null;
  label: string;
}): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const t = await getDictionary();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: t.actions.pickDateFirst };
  }

  if (input.planDayId != null) {
    const [owned] = await db
      .select({ id: planDays.id })
      .from(planDays)
      .innerJoin(plans, eq(planDays.planId, plans.id))
      .where(and(eq(planDays.id, input.planDayId), eq(plans.userId, user.id)));
    if (!owned) return { ok: false, error: t.actions.notFound };
  }

  const label = input.label.trim() || t.common.workout;
  await db.insert(scheduleEntries).values({
    userId: user.id,
    date: input.date,
    planDayId: input.planDayId,
    label,
    status: "planned",
  });
  revalidateApp();
  return { ok: true };
}

export async function updateScheduleStatus(
  id: number,
  status: "planned" | "done" | "skipped",
): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const updated = await db
    .update(scheduleEntries)
    .set({ status })
    .where(and(eq(scheduleEntries.id, id), eq(scheduleEntries.userId, user.id)))
    .returning({ id: scheduleEntries.id });
  if (updated.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.notFound };
  }
  revalidateApp();
  return { ok: true };
}

export async function deleteScheduleEntry(id: number): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const deleted = await db
    .delete(scheduleEntries)
    .where(and(eq(scheduleEntries.id, id), eq(scheduleEntries.userId, user.id)))
    .returning({ id: scheduleEntries.id });
  if (deleted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.notFound };
  }
  revalidateApp();
  return { ok: true };
}

const BODY_MEASUREMENT_FIELDS = [
  "heightCm",
  "weightKg",
  "waistCm",
  "chestCm",
  "thighCm",
  "hipCm",
] as const;

function parseBodyMeasurements(
  input: Pick<BodyEntryInput, (typeof BODY_MEASUREMENT_FIELDS)[number]>,
): Record<string, number | null> | null {
  const values: Record<string, number | null> = {};
  for (const field of BODY_MEASUREMENT_FIELDS) {
    const value = input[field];
    if (value === undefined) {
      values[field] = null;
      continue;
    }
    if (!isPositiveDecimal(String(value))) return null;
    values[field] = value;
  }
  return values;
}

export async function addBodyEntry(
  input: BodyEntryInput,
): Promise<ActionResult<{ id: number }>> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const t = await getDictionary();

  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: t.actions.pickDateFirst };
  }

  const values = parseBodyMeasurements(input);
  if (!values) return { ok: false, error: t.actions.invalidMeasurement };

  const hasMeasurement = BODY_MEASUREMENT_FIELDS.some(
    (field) => values[field] !== null,
  );
  if (!hasMeasurement && !input.photoPath) {
    return { ok: false, error: t.actions.bodyEntryEmpty };
  }

  const [entry] = await db
    .insert(bodyMeasurements)
    .values({
      userId: user.id,
      date,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      waistCm: values.waistCm,
      chestCm: values.chestCm,
      thighCm: values.thighCm,
      hipCm: values.hipCm,
      photoPath: input.photoPath?.trim() || null,
      notes: input.notes?.trim() || null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  revalidateApp();
  return { ok: true, data: { id: entry.id } };
}

/**
 * Rewrites a check-in in place. `photoPath` is tri-state (see
 * `BodyEntryUpdateInput`) so the caller can leave the photo untouched without
 * having to re-upload or re-resolve the existing path.
 */
export async function updateBodyEntry(
  id: number,
  input: BodyEntryUpdateInput,
): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const t = await getDictionary();

  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: t.actions.pickDateFirst };
  }

  const values = parseBodyMeasurements(input);
  if (!values) return { ok: false, error: t.actions.invalidMeasurement };

  const [existing] = await db
    .select({ photoPath: bodyMeasurements.photoPath })
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, user.id)));
  if (!existing) return { ok: false, error: t.actions.notFound };

  const photoPath =
    input.photoPath === undefined ? existing.photoPath : input.photoPath;
  const hasMeasurement = BODY_MEASUREMENT_FIELDS.some(
    (field) => values[field] !== null,
  );
  if (!hasMeasurement && !photoPath) {
    return { ok: false, error: t.actions.bodyEntryEmpty };
  }

  // A replaced or removed photo orphans the old storage object — clean it up
  // best-effort, same as deleteBodyEntry below (the DB row is already the
  // source of truth once this update commits).
  if (
    input.photoPath !== undefined &&
    existing.photoPath &&
    existing.photoPath !== input.photoPath
  ) {
    const supabase = await createClient();
    const { error: storageError } = await supabase.storage
      .from(BODY_PHOTOS_BUCKET)
      .remove([existing.photoPath]);
    if (storageError) {
      console.error("Failed to remove replaced body photo from storage:", storageError);
    }
  }

  await db
    .update(bodyMeasurements)
    .set({
      date,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      waistCm: values.waistCm,
      chestCm: values.chestCm,
      thighCm: values.thighCm,
      hipCm: values.hipCm,
      photoPath,
      notes: input.notes?.trim() || null,
    })
    .where(eq(bodyMeasurements.id, id));

  revalidateApp();
  return { ok: true };
}

export async function deleteBodyEntry(id: number): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const deleted = await db
    .delete(bodyMeasurements)
    .where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, user.id)))
    .returning({ id: bodyMeasurements.id, photoPath: bodyMeasurements.photoPath });
  if (deleted.length === 0) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.notFound };
  }
  const photoPath = deleted[0].photoPath;
  if (photoPath) {
    const supabase = await createClient();
    const { error: storageError } = await supabase.storage
      .from(BODY_PHOTOS_BUCKET)
      .remove([photoPath]);
    if (storageError) {
      console.error("Failed to remove body photo from storage:", storageError);
    }
  }
  revalidateApp();
  return { ok: true };
}

/** Most recent workout id — used to deep-link after saving. */
export async function getLatestWorkoutId(): Promise<number | null> {
  const user = await getUser();
  if (!user) return null;
  const db = getDb();
  const [latest] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(eq(workouts.userId, user.id))
    .orderBy(desc(workouts.id))
    .limit(1);
  return latest?.id ?? null;
}
