import "server-only";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

/**
 * Every server action returns this instead of throwing — callers branch on
 * `.ok`. Shared by the feature modules in this directory and by
 * `src/lib/auth-actions.ts`.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export function revalidateApp() {
  revalidatePath("/", "layout");
}

/**
 * Every mutating action calls this first, independent of whatever the
 * proxy already checked (src/proxy.ts) — a matcher change there could
 * silently stop covering a route without this check ever failing loudly.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    const t = await getDictionary();
    return { user: null, error: t.actions.mustSignIn } as const;
  }
  return { user, error: null } as const;
}
