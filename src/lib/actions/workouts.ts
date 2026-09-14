"use server";

import { and, eq, desc, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  exercises,
  scheduleEntries,
  workouts,
  workoutSets,
} from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { estimateOneRepMax } from "@/lib/overload";
import type { WorkoutPayload } from "@/lib/types";
import { requireUser, revalidateApp, type ActionResult } from "./_shared";

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

  // Wrap the core writes in a transaction so every insert — workout, sets,
  // library upsert, schedule update — commits or rolls back together. Without
  // this, a failure on a single set row (e.g. a Postgres `real` overflow from
  // an enormous weight that passed JS's Number.isFinite check) would leave an
  // orphan workout row and no sets, which is worse than the old N+1 loop's
  // "partial sets committed" failure mode.
  const result = await db.transaction(async (tx) => {
    // Previous best estimated 1RM per exercise, for PR detection — scoped to
    // this user's own history AND to only the exercises being logged, otherwise
    // a PR badge could be computed against (and leak) a different user's lifts,
    // and we'd ship every past set just to judge today's handful. The 1RM is
    // still computed in JS so the Epley semantics stay identical.
    const exerciseNames = cleanExercises.map((e) => e.name);
    const priorBest = new Map<string, number>();
    const history = exerciseNames.length
      ? await tx
          .select({ set: workoutSets })
          .from(workoutSets)
          .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
          .where(
            and(
              eq(workouts.userId, user.id),
              inArray(workoutSets.exerciseName, exerciseNames),
            ),
          )
      : [];
    for (const { set } of history) {
      const e1rm = estimateOneRepMax(set.weightKg, set.reps);
      const prev = priorBest.get(set.exerciseName) ?? 0;
      if (e1rm > prev) priorBest.set(set.exerciseName, e1rm);
    }

    const [workout] = await tx
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
    const setsToInsert: (typeof workoutSets.$inferInsert)[] = [];
    const libraryToInsert: (typeof exercises.$inferInsert)[] = [];

    for (const [exerciseOrder, exercise] of cleanExercises.entries()) {
      const prior = priorBest.get(exercise.name) ?? 0;
      const bestNew = Math.max(
        ...exercise.sets.map((s) => estimateOneRepMax(s.weightKg, s.reps)),
      );
      const isPrSession = prior > 0 && bestNew > prior;
      if (isPrSession) prExercises.push(exercise.name);

      for (const [i, set] of exercise.sets.entries()) {
        setsToInsert.push({
          workoutId: workout.id,
          exerciseName: exercise.name,
          exerciseOrder,
          setNumber: i + 1,
          weightKg: set.weightKg,
          reps: set.reps,
          isPr:
            isPrSession && estimateOneRepMax(set.weightKg, set.reps) === bestNew,
        });
      }

      // Make sure logged exercises exist in this user's library for future search.
      libraryToInsert.push({
        name: exercise.name,
        userId: user.id,
        bodyPart: "other",
        equipment: "other",
        target: "other",
        source: "custom",
      });
    }

    // Batch every set of the workout into one multi-row insert and every
    // library upsert into one conflict-guarded insert — cutting 2×N
    // round-trips down to 2 regardless of exercise count.
    await tx.insert(workoutSets).values(setsToInsert);
    await tx
      .insert(exercises)
      .values(libraryToInsert)
      .onConflictDoNothing({ target: [exercises.name, exercises.userId] });

    if (payload.scheduleEntryId != null) {
      await tx
        .update(scheduleEntries)
        .set({ status: "done", workoutId: workout.id })
        .where(
          and(
            eq(scheduleEntries.id, payload.scheduleEntryId),
            eq(scheduleEntries.userId, user.id),
          ),
        );
    }

    return { workoutId: workout.id, prExercises };
  });

  revalidateApp();
  return { ok: true, data: result };
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
