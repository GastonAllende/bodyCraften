import "server-only";

import { SEED_EXERCISES } from "@/db/seed-exercises";
import type { LibraryExercise } from "@/lib/types";

const EXERCISEDB_URL =
  "https://exercisedb.p.rapidapi.com/exercises?limit=1500&offset=0";

type ExerciseDbItem = {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string[];
};

export type ExternalExerciseResult = {
  exercises: LibraryExercise[];
  /** Where the catalog came from. */
  source: "api" | "built-in";
  error?: string;
};

/**
 * Fetches the exercise catalog from ExerciseDB (RapidAPI) when
 * EXERCISEDB_API_KEY is set; otherwise serves the built-in catalog.
 * The remote response is cached for a day.
 */
export async function fetchExerciseCatalog(): Promise<ExternalExerciseResult> {
  const apiKey = process.env.EXERCISEDB_API_KEY;

  if (!apiKey) {
    return { exercises: seedCatalog(), source: "built-in" };
  }

  try {
    const res = await fetch(EXERCISEDB_URL, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "exercisedb.p.rapidapi.com",
      },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      throw new Error(`ExerciseDB responded with ${res.status}`);
    }
    const items = (await res.json()) as ExerciseDbItem[];
    const exercises: LibraryExercise[] = items.map((item) => ({
      name: titleCase(item.name),
      bodyPart: item.bodyPart,
      equipment: item.equipment,
      target: item.target,
      instructions: item.instructions?.join(" "),
      source: "api",
      remote: true,
    }));
    return { exercises, source: "api" };
  } catch (error) {
    return {
      exercises: seedCatalog(),
      source: "built-in",
      error:
        error instanceof Error ? error.message : "Failed to reach ExerciseDB",
    };
  }
}

function seedCatalog(): LibraryExercise[] {
  return SEED_EXERCISES.map((e) => ({ ...e, source: "built-in" as const }));
}

function titleCase(value: string): string {
  return value.replace(
    /\b([a-z])/g,
    (_, letter: string) => letter.toUpperCase(),
  );
}
