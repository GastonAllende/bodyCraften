"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { planDays, plans, scheduleEntries } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/server";
import { requireUser, revalidateApp, type ActionResult } from "./_shared";

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

