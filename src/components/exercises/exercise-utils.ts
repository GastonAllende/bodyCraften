import type { LibraryExercise } from "@/lib/types";

/**
 * What the user reads. `name` stays canonical English because it is the key the
 * logger and plans write to the DB — only the label is translated.
 */
export function label(exercise: LibraryExercise): string {
  return exercise.displayName ?? exercise.name;
}

/**
 * Only rows the user actually owns (`custom`/`api` source) can be removed —
 * `built-in` rows are the shared catalog (`user_id IS NULL`) and
 * `removeExercise` scopes its DELETE to `user_id = userId`, so it can never
 * match one. Same rows define "Saved": the shared catalog is always usable
 * for logging, but "Saved" means "I added this," not "this exists."
 */
export function isOwned(exercise: LibraryExercise): boolean {
  return !exercise.remote && exercise.source !== "built-in";
}
