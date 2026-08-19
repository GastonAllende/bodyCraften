import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { exercises } from "@/db/schema";
import { SEED_EXERCISES } from "@/db/seed-exercises";

/**
 * One-time, idempotent seed of the shared/global exercise catalog
 * (`user_id IS NULL`). Run manually via `npm run db:seed` after migrations —
 * this no longer runs implicitly on app boot (see src/db/index.ts).
 */
async function main() {
  const db = getDb();
  const inserted = await db
    .insert(exercises)
    .values(
      SEED_EXERCISES.map((e) => ({
        name: e.name,
        bodyPart: e.bodyPart,
        equipment: e.equipment,
        target: e.target,
        source: "built-in" as const,
      })),
    )
    .onConflictDoNothing({
      target: exercises.name,
      where: sql`${exercises.userId} is null`,
    })
    .returning({ id: exercises.id });

  console.log(
    `Seeded ${inserted.length} of ${SEED_EXERCISES.length} built-in exercises (rest already existed).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
