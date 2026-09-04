"use client";

import { useMemo, useState } from "react";
import { isOwned, label } from "@/components/exercises/exercise-utils";
import type { LibraryExercise } from "@/lib/types";

const PAGE_SIZE = 48;

/**
 * Search/scope/body-part filtering and pagination for the exercise browser —
 * kept separate from dialog/mutation orchestration so the two concerns can
 * change independently.
 */
export function useExerciseFilters(exercises: LibraryExercise[]) {
  const [query, setQueryState] = useState("");
  const [scope, setScope] = useState<"all" | "saved">("all");
  const [bodyPart, setBodyPartState] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const saved = useMemo(() => exercises.filter(isOwned), [exercises]);
  const scoped = scope === "saved" ? saved : exercises;

  const bodyParts = useMemo(
    () => [...new Set(scoped.map((e) => e.bodyPart.toLowerCase()))].sort(),
    [scoped],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((e) => {
      if (bodyPart && e.bodyPart.toLowerCase() !== bodyPart) return false;
      if (!q) return true;
      // Match the translated label as well as the canonical name, so a Spanish
      // user searching "sentadilla" finds the exercise stored as "Squat".
      return (
        label(e).toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [scoped, query, bodyPart]);

  const visible = filtered.slice(0, limit);

  function setQuery(next: string) {
    setQueryState(next);
    setLimit(PAGE_SIZE);
  }

  function changeScope(next: "all" | "saved") {
    setScope(next);
    // The body-part chips are derived from the scope, so an active one may not
    // exist on the other side of the toggle.
    setBodyPartState(null);
    setLimit(PAGE_SIZE);
  }

  function setBodyPart(part: string | null) {
    setBodyPartState((prev) => (part !== null && prev === part ? null : part));
    setLimit(PAGE_SIZE);
  }

  function showMore() {
    setLimit((l) => l + PAGE_SIZE);
  }

  return {
    query,
    setQuery,
    scope,
    changeScope,
    bodyPart,
    setBodyPart,
    bodyParts,
    saved,
    filtered,
    visible,
    showMore,
  };
}
