"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { revalidateApp, type ActionResult } from "./_shared";

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
