"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyMeasurements } from "@/db/schema";
import { BODY_PHOTOS_BUCKET } from "@/lib/storage";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { BodyEntryInput, BodyEntryUpdateInput } from "@/lib/types";
import { isPositiveDecimal } from "@/lib/validation";
import { requireUser, revalidateApp, type ActionResult } from "./_shared";

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
