import { pgSchema, uuid } from "drizzle-orm/pg-core";

/**
 * Minimal stub for Supabase's `auth.users` table. Drizzle doesn't manage the
 * `auth` schema — this exists only so `user_id` columns can `.references()`
 * it in TS/migrations without drizzle-kit trying to create `auth.users` itself.
 */
export const authUsers = pgSchema("auth").table("users", {
  id: uuid("id").primaryKey(),
});
