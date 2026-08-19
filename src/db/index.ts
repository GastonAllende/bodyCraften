import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Row Level Security is enabled on every table as defense-in-depth, but a
 * direct Drizzle connection over DATABASE_URL never goes through PostgREST,
 * so `auth.uid()` is NULL here and RLS has no effect on these queries. Every
 * query/action in this app enforces `user_id` scoping itself — that is the
 * real security boundary, not RLS. See queries.ts / actions.ts.
 */
function createDb(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  // Supavisor's transaction pooling mode (the pooled connection string, port
  // 6543) doesn't reliably support server-side prepared statements.
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  bodycraftenDb?: PostgresJsDatabase<typeof schema>;
};

let cached = globalForDb.bodycraftenDb;

/**
 * Lazy accessor, not a top-level `export const db` — constructing the client
 * eagerly at module-eval time can crash `next build`'s static analysis pass
 * if DATABASE_URL isn't loaded yet. No Proxy wrapper: Supabase/Postgres
 * adapters that inspect the client's shape (property/method checks) break
 * silently behind a Proxy.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!cached) {
    cached = createDb();
    if (process.env.NODE_ENV !== "production") {
      globalForDb.bodycraftenDb = cached;
    }
  }
  return cached;
}
