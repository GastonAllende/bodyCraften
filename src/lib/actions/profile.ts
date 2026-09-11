"use server";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/server";
import type { ProfileInput } from "@/lib/types";
import { isGender, isValidBirthDate, isValidName } from "@/lib/validation";
import { requireUser, revalidateApp, type ActionResult } from "./_shared";

const NAME_FIELDS = ["firstName", "lastName", "displayName"] as const;

/**
 * Upserts the signed-in user's profile row. There is one row per user keyed by
 * `user_id`, created lazily here on first save — hence the upsert rather than
 * an insert plus a separate "does it exist" read.
 *
 * Every field is optional: an empty string means "unset" and is stored as NULL,
 * so `getProfile()` reading it back as `""` round-trips unchanged. The three
 * predicates below are the same ones the form gates on, re-checked because a
 * server action is a public endpoint.
 */
export async function updateProfile(
  input: ProfileInput,
): Promise<ActionResult> {
  const { user, error } = await requireUser();
  if (!user) return { ok: false, error };
  const t = await getDictionary();

  const names = {} as Record<(typeof NAME_FIELDS)[number], string | null>;
  for (const field of NAME_FIELDS) {
    const value = input[field].trim();
    if (!isValidName(value)) return { ok: false, error: t.actions.nameTooLong };
    names[field] = value || null;
  }

  const birthDate = input.birthDate.trim();
  if (!isValidBirthDate(birthDate)) {
    return { ok: false, error: t.actions.invalidBirthDate };
  }

  const gender = input.gender.trim();
  if (gender !== "" && !isGender(gender)) {
    return { ok: false, error: t.actions.invalidGender };
  }

  const now = new Date().toISOString();
  const values = {
    firstName: names.firstName,
    lastName: names.lastName,
    displayName: names.displayName,
    birthDate: birthDate || null,
    gender: gender || null,
  };

  await getDb()
    .insert(profiles)
    .values({ userId: user.id, ...values, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { ...values, updatedAt: now },
    });

  revalidateApp();
  return { ok: true };
}
