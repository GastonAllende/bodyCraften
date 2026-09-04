"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { sanitizeDecimal, sanitizeInteger } from "@/lib/validation";

export type SetRow = { weight: string; reps: string; done: boolean };

export function parseNum(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ExerciseSetRow({
  index,
  set,
  prev,
  exerciseName,
  onUpdate,
}: {
  index: number;
  set: SetRow;
  prev?: { weightKg: number; reps: number };
  exerciseName: string;
  onUpdate: (patch: Partial<SetRow>) => void;
}) {
  const { t } = useI18n();
  const filled = parseNum(set.reps) > 0;

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_2.25rem] items-center gap-2 sm:grid-cols-[2.5rem_5rem_1fr_1fr_2.25rem]">
      <span className="text-center text-sm text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <button
        type="button"
        className="hidden truncate rounded px-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
        title={t.logger.copyLastSet}
        onClick={() =>
          prev &&
          onUpdate({ weight: String(prev.weightKg), reps: String(prev.reps) })
        }
      >
        {prev ? (
          <span className="inline-flex items-center gap-1">
            <Copy className="size-3" />
            {prev.weightKg}×{prev.reps}
          </span>
        ) : (
          "—"
        )}
      </button>
      <Input
        inputMode="decimal"
        placeholder={prev ? String(prev.weightKg) : "0"}
        value={set.weight}
        onChange={(e) => onUpdate({ weight: sanitizeDecimal(e.target.value) })}
        className="h-9 text-center tabular-nums"
        aria-label={fmt(t.logger.setWeight, {
          name: exerciseName,
          number: index + 1,
        })}
      />
      <Input
        inputMode="numeric"
        placeholder={prev ? String(prev.reps) : "0"}
        value={set.reps}
        // A blank row is fine — it just isn't logged. A typed 0 is a mistake
        // worth pointing at.
        aria-invalid={set.reps !== "" && !filled}
        onChange={(e) => onUpdate({ reps: sanitizeInteger(e.target.value) })}
        className="h-9 text-center tabular-nums"
        aria-label={fmt(t.logger.setReps, {
          name: exerciseName,
          number: index + 1,
        })}
      />
      <Button
        type="button"
        variant={set.done ? "default" : "outline"}
        size="icon"
        className={cn(
          "size-9",
          set.done && "bg-emerald-600 text-white hover:bg-emerald-600/90",
        )}
        aria-label={t.logger.markSetDone}
        onClick={() => {
          if (!set.done && !filled && prev) {
            onUpdate({
              weight: String(prev.weightKg),
              reps: String(prev.reps),
              done: true,
            });
          } else {
            onUpdate({ done: !set.done });
          }
        }}
      >
        <Check className="size-4" />
      </Button>
    </div>
  );
}
