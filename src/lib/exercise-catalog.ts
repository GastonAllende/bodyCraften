import "server-only";

import canonical from "@/db/exercises.json";
import spanish from "@/db/exercises.es.json";
import type { Locale } from "@/lib/i18n/config";
import type { LibraryExercise } from "@/lib/types";

/**
 * The exercise catalog is vendored (see scripts note in README): `exercises.json`
 * holds the canonical rows and `exercises.es.json` is a display-only overlay
 * keyed by the same id.
 *
 * **English names are the join key.** `workout_sets.exercise_name` and
 * `plan_exercises.exercise_name` store the canonical `name`; a translated label
 * only ever travels in `displayName`. Writing a localised name to the DB would
 * split a user's history in two the moment they switch language.
 */
type CatalogRow = {
  id: string;
  name: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  difficulty?: string;
  mechanic?: string;
  force?: string;
};

/** The subset of fields the locale overlay may override. */
type LocalisedRow = Partial<
  Pick<
    CatalogRow,
    "name" | "bodyPart" | "equipment" | "target" | "secondaryMuscles" | "instructions"
  >
>;

/**
 * `bodyPart` drives the filter chips, so it is an app-owned facet rather than a
 * vendor string: the catalog's vocabulary is folded into the same buckets the
 * seeded library already uses, and the labels are translated in `dictionaries.ts`.
 * Without this, a Spanish user sees "arms" and "brazos superiores" as two chips.
 */
const BODY_PART_BUCKET: Record<string, string> = {
  back: "back",
  cardio: "cardio",
  chest: "chest",
  "lower arms": "arms",
  "upper arms": "arms",
  "lower legs": "calves",
  "upper legs": "legs",
  neck: "neck",
  shoulders: "shoulders",
  waist: "core",
};

export function toBodyPartBucket(value: string | undefined): string {
  const key = value?.trim().toLowerCase() ?? "";
  return BODY_PART_BUCKET[key] ?? key ?? "other";
}

const ROWS = canonical as CatalogRow[];
const OVERLAYS: Partial<Record<Locale, Record<string, LocalisedRow>>> = {
  es: spanish as Record<string, LocalisedRow>,
};

/** The full catalog, with `displayName` and localised copy for non-English locales. */
export function getVendoredCatalog(locale: Locale): LibraryExercise[] {
  const overlay = OVERLAYS[locale];

  return ROWS.map((row) => {
    const t = overlay?.[row.id];
    const translatedName = t?.name && t.name !== row.name ? t.name : undefined;
    return {
      name: row.name,
      displayName: translatedName,
      // Bucketed from the canonical (English) value so the key is stable; the
      // overlay's translated bodyPart is intentionally unused.
      bodyPart: toBodyPartBucket(row.bodyPart),
      equipment: lower(t?.equipment ?? row.equipment) || "body weight",
      target: lower(t?.target ?? row.target),
      // Stored as one string (the DB column is text); the steps are kept
      // alongside so the detail dialog can render them as a numbered list.
      instructions: joinSteps(t?.instructions ?? row.instructions),
      instructionSteps: t?.instructions ?? row.instructions,
      source: "built-in" as const,
      remote: true,
    };
  });
}

const BY_NAME = new Map(ROWS.map((r) => [r.name.trim().toLowerCase(), r]));

/**
 * Canonical (English) facets for a catalog exercise, looked up by name. Writes
 * go through this so a save made from the Spanish UI still stores English
 * values — otherwise an English user later sees "asistido" on the badge.
 */
export function findCanonical(name: string):
  | { bodyPart: string; equipment: string; target: string; instructions?: string }
  | undefined {
  const row = BY_NAME.get(name.trim().toLowerCase());
  if (!row) return undefined;
  return {
    bodyPart: toBodyPartBucket(row.bodyPart),
    equipment: lower(row.equipment) || "body weight",
    target: lower(row.target),
    instructions: joinSteps(row.instructions),
  };
}

function lower(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function joinSteps(steps: string[] | undefined): string | undefined {
  const text = steps?.map((s) => s.trim()).filter(Boolean).join(" ");
  return text || undefined;
}
