"use client";

import { motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import { formatShortDate } from "@/lib/overload";
import type { LastSessionHints } from "@/lib/types";
import { ExerciseSetRow, type SetRow } from "./exercise-set-row";

export type LoggedExercise = {
  key: string;
  name: string;
  targetReps?: string;
  sets: SetRow[];
};

export function LoggedExerciseCard({
  exercise,
  hint,
  onRemove,
  onUpdateSet,
  onAddSet,
}: {
  exercise: LoggedExercise;
  hint?: LastSessionHints[string];
  onRemove: () => void;
  onUpdateSet: (index: number, patch: Partial<SetRow>) => void;
  onAddSet: () => void;
}) {
  const { locale, t } = useI18n();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-lg border p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium leading-tight">
            {exercise.name}
            {exercise.targetReps && (
              <Badge variant="secondary" className="ml-2">
                {fmt(t.logger.targetReps, { reps: exercise.targetReps })}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {hint
              ? fmt(t.logger.lastTime, {
                  date: formatShortDate(hint.date, locale),
                  sets: hint.sets
                    .map((s) => `${s.weightKg}×${s.reps}`)
                    .join("  "),
                })
              : t.logger.firstTime}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label={fmt(t.logger.removeExercise, { name: exercise.name })}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="grid grid-cols-[2rem_1fr_1fr_2.25rem] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[2.5rem_5rem_1fr_1fr_2.25rem]">
          <span>{t.logger.setColumn}</span>
          <span className="hidden sm:block">{t.logger.prevColumn}</span>
          <span>{t.logger.kgColumn}</span>
          <span>{t.logger.repsColumn}</span>
          <span />
        </div>
        {exercise.sets.map((set, i) => (
          <ExerciseSetRow
            key={i}
            index={i}
            set={set}
            prev={hint?.sets[i]}
            exerciseName={exercise.name}
            onUpdate={(patch) => onUpdateSet(i, patch)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={onAddSet}
        >
          <Plus className="size-4" /> {t.logger.addSet}
        </Button>
      </div>
    </motion.div>
  );
}
