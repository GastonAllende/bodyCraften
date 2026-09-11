"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { exercises } from "@/db/schema";
import { findCanonical } from "@/lib/exercise-catalog";
import { EXERCISE_IMAGES_BUCKET } from "@/lib/storage";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseInput, ExerciseUpdateInput } from "@/lib/types";
import { requireUser, revalidateApp, type ActionResult } from "./_shared";

export async function addCustomExercise(input: ExerciseInput): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const name = input.name.trim();
  if (name.length < 2) {
    const t = await getDictionary();
    return { ok: false, error: t.actions.giveExerciseName };
  }
  const imagePath = input.imagePath?.trim() || null;
  const inserted = await db
    .insert(exercises)
    .values({
      name,
      userId: user.id,
      bodyPart: input.bodyPart.trim() || "other",
      equipment: input.equipment.trim() || "other",
      target: input.target.trim() || "other",
      instructions: input.instructions?.trim() || null,
      imagePath,
      source: "custom",
    })
    .onConflictDoNothing({ target: [exercises.name, exercises.userId] })
    .returning();
  if (inserted.length === 0) {
    // The name collided, so this exercise was never saved — an image the
    // client already uploaded for it would otherwise be orphaned forever.
    if (imagePath) {
      const supabase = await createClient();
      const { error: storageError } = await supabase.storage
        .from(EXERCISE_IMAGES_BUCKET)
        .remove([imagePath]);
      if (storageError) {
        console.error("Failed to remove orphaned exercise image:", storageError);
      }
    }
    const t = await getDictionary();
    return { ok: false, error: fmt(t.actions.alreadyInLibrary, { name }) };
  }
  revalidateApp();
  return { ok: true };
}

/**
 * Edits an exercise this user owns. `name` can't change — see
 * `ExerciseUpdateInput`. Scoped by `id AND user_id` so a built-in catalog row
 * (`user_id IS NULL`) can never match, matching `isOwned()` in the UI.
 */
export async function updateExercise(
  id: number,
  input: ExerciseUpdateInput,
): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const db = getDb();
  const t = await getDictionary();

  const [existing] = await db
    .select({ imagePath: exercises.imagePath })
    .from(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)));
  if (!existing) return { ok: false, error: t.actions.notFound };

  const imagePath =
    input.imagePath === undefined ? existing.imagePath : input.imagePath;

  // A replaced or removed image orphans the old storage object — clean it up
  // best-effort, same as updateBodyEntry below.
  if (
    input.imagePath !== undefined &&
    existing.imagePath &&
    existing.imagePath !== input.imagePath
  ) {
    const supabase = await createClient();
    const { error: storageError } = await supabase.storage
      .from(EXERCISE_IMAGES_BUCKET)
      .remove([existing.imagePath]);
    if (storageError) {
      console.error("Failed to remove replaced exercise image:", storageError);
    }
  }

  await db
    .update(exercises)
    .set({
      bodyPart: input.bodyPart.trim() || "other",
      equipment: input.equipment.trim() || "other",
      target: input.target.trim() || "other",
      instructions: input.instructions?.trim() || null,
      imagePath,
    })
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)));

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
  const imagePath = deleted[0].imagePath;
  if (imagePath) {
    const supabase = await createClient();
    const { error: storageError } = await supabase.storage
      .from(EXERCISE_IMAGES_BUCKET)
      .remove([imagePath]);
    if (storageError) {
      console.error("Failed to remove exercise image from storage:", storageError);
    }
  }
  revalidateApp();
  return { ok: true };
}
