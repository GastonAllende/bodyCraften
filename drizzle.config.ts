import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    // Migrations run against the direct connection, not the pooled one —
    // Supavisor's transaction pooling mode doesn't support the session-level
    // features drizzle-kit needs.
    url: process.env.DIRECT_URL!,
  },
});
