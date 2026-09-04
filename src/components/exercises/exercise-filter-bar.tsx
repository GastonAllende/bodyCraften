"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function ExerciseFilterBar({
  query,
  onQueryChange,
  onNewExercise,
  scope,
  onScopeChange,
  savedCount,
  bodyPart,
  onBodyPartChange,
  bodyParts,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onNewExercise: () => void;
  scope: "all" | "saved";
  onScopeChange: (scope: "all" | "saved") => void;
  savedCount: number;
  bodyPart: string | null;
  onBodyPartChange: (part: string | null) => void;
  bodyParts: string[];
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.exercisesPage.searchPlaceholder}
            className="pl-8"
          />
        </div>
        <Button variant="secondary" onClick={onNewExercise}>
          <Plus className="size-4" /> {t.exercisesPage.newExercise}
        </Button>
      </div>

      <div className="flex w-full max-w-sm rounded-lg border p-1">
        <ScopeTab
          label={t.exercisesPage.scopeAll}
          active={scope === "all"}
          onClick={() => onScopeChange("all")}
        />
        <ScopeTab
          label={fmt(t.exercisesPage.scopeSaved, { count: savedCount })}
          active={scope === "saved"}
          onClick={() => onScopeChange("saved")}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label={t.exercisesPage.all}
          active={bodyPart === null}
          onClick={() => onBodyPartChange(null)}
        />
        {bodyParts.map((part) => (
          <FilterChip
            key={part}
            label={t.exercisesPage.bodyParts[part] ?? part}
            active={bodyPart === part}
            onClick={() => onBodyPartChange(part)}
          />
        ))}
      </div>
    </div>
  );
}

function ScopeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
