"use server";

import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export async function signUp(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const t = await getDictionary();
  const email = input.email.trim();
  if (!email || !input.password) {
    return { ok: false, error: t.auth.fillAllFields };
  }
  if (input.password.length < 8) {
    return { ok: false, error: t.auth.passwordTooShort };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { emailRedirectTo: `${await getSiteUrl()}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const t = await getDictionary();
  const email = input.email.trim();
  if (!email || !input.password) {
    return { ok: false, error: t.auth.fillAllFields };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) return { ok: false, error: t.auth.invalidCredentials };
  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  const trimmed = email.trim();
  if (trimmed) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${await getSiteUrl()}/auth/callback?next=/reset-password`,
    });
  }
  // Always ok, whether or not the email exists — don't leak account existence.
  return { ok: true };
}

export async function updatePassword(password: string): Promise<ActionResult> {
  const t = await getDictionary();
  if (password.length < 8) {
    return { ok: false, error: t.auth.passwordTooShort };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
