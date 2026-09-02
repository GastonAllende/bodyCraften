import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `getClaims()` (not `getSession()`) cryptographically verifies the JWT —
 * locally via cached JWKS for projects on asymmetric signing keys (the
 * default), so unlike `getUser()` this doesn't cost a network round-trip to
 * the Auth server on every call. It won't catch a server-side logout/revoke
 * mid-session the way `getUser()` would — an accepted trade for this app's
 * threat model. Don't swap in `getSession()`, which skips verification
 * entirely and trusts a possibly-stale cookie.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? { id: data.claims.sub } : null;
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
