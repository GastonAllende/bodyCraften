"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { planDays, planExercises, plans } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/server";
import type { PlanExerciseInput, PlanInput, PlanUpdateInput } from "@/lib/types";
import { isValidRepRange } from "@/lib/validation";
import { requireUser, revalidateApp, type ActionResult } from "./_shared";

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
