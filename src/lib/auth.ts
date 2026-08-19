import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `getUser()` (not `getSession()`) revalidates the JWT against Supabase's
 * auth server rather than trusting a possibly-stale cookie — the
 * documented-safe pattern for server-side checks with `@supabase/ssr`.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** For pages that require a session. Redirects rather than erroring. */
export async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user.id;
}

/** Absolute origin for building Supabase email-redirect URLs. */
export async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
