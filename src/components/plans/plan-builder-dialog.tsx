"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { createPlan, updatePlan } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import {
  isPositiveInteger,
  isValidRepRange,
  sanitizeInteger,
  sanitizeRepRange,
} from "@/lib/validation";
import type { PlanInput, PlanWithDays } from "@/lib/types";

/** Rest and notes are not editable here, but they ride along so an edit
 *  doesn't wipe what the AI generator prescribed. */
type BuilderExercise = {
  name: string;
  sets: string;
  reps: string;
  restSec: number | null;
  notes: string | null;
};
/** `id` is set for days that already exist in the database. */
type BuilderDay = { id?: number; name: string; exercises: BuilderExercise[] };

function emptyExercise(): BuilderExercise {
  return { name: "", sets: "3", reps: "8-12", restSec: null, notes: null };
}

export function PlanBuilderDialog({
  open,
  onOpenChange,
  exerciseNames,
  plan,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseNames: string[];
  /** Present when editing an existing plan; absent when creating a new one. */
  plan?: PlanWithDays;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [days, setDays] = useState<BuilderDay[]>(() =>
    plan
      ? plan.days.map((day) => ({
          id: day.id,
          name: day.name,
          exercises: day.exercises.map((e) => ({
            name: e.exerciseName,
            sets: String(e.sets),
            reps: e.reps,
            restSec: e.restSec,
            notes: e.notes,
          })),
        }))
      : [
          {
            name: fmt(t.planBuilder.dayDefault, { number: 1 }),
            exercises: [emptyExercise()],
          },
        ],
  );
  const [saving, startSaving] = useTransition();

  function updateDay(index: number, patch: Partial<BuilderDay>) {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  // Only rows with a name get saved, so only those need to hold valid numbers.
  const namedRows = days.flatMap((d) =>
    d.exercises.filter((e) => e.name.trim()),
  );
  const hasInvalidRow = namedRows.some(
    (e) => !isPositiveInteger(e.sets) || !isValidRepRange(e.reps),
  );

  function collectDays() {
    return days.map((d) => ({
      id: d.id,
      name: d.name,
      exercises: d.exercises
        .filter((e) => e.name.trim())
        .map((e) => ({
          name: e.name,
          sets: Number(e.sets) || 3,
          reps: e.reps,
          restSec: e.restSec ?? undefined,
          notes: e.notes ?? undefined,
        })),
    }));
  }

  function submit() {
    startSaving(async () => {
      if (plan) {
        const result = await updatePlan(plan.id, {
          name,
          description: description || undefined,
          days: collectDays(),
        });
        if (result.ok) {
          toast.success(fmt(t.planBuilder.updated, { name: name.trim() }));
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
        return;
      }

      const input: PlanInput = {
        name,
        description: description || undefined,
        source: "manual",
        days: collectDays(),
      };
      const result = await createPlan(input);
      if (result.ok) {
        toast.success(fmt(t.planBuilder.created, { name: name.trim() }));
        onOpenChange(false);
        setName("");
        setDescription("");
        setDays([
          {
            name: fmt(t.planBuilder.dayDefault, { number: 1 }),
            exercises: [emptyExercise()],
          },
        ]);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {plan ? t.planBuilder.editTitle : t.planBuilder.title}
          </DialogTitle>
          <DialogDescription>
            {plan ? t.planBuilder.editDesc : t.planBuilder.desc}
          </DialogDescription>
        </DialogHeader>

        <datalist id="exercise-suggestions">
          {exerciseNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="plan-name">{t.planBuilder.planName}</Label>
              <Input
                id="plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.planBuilder.planNamePlaceholder}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-desc">{t.planBuilder.description}</Label>
              <Input
                id="plan-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.planBuilder.descriptionPlaceholder}
              />
            </div>
          </div>

          {days.map((day, dayIndex) => (
            <div key={dayIndex} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={day.name}
                  onChange={(e) => updateDay(dayIndex, { name: e.target.value })}
                  className="h-8 max-w-48 font-medium"
                  aria-label={fmt(t.planBuilder.dayNameAria, {
                    number: dayIndex + 1,
                  })}
                />
                {days.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7 text-muted-foreground"
                    aria-label={t.planBuilder.removeDay}
                    onClick={() =>
                      setDays((prev) => prev.filter((_, i) => i !== dayIndex))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                {day.exercises.map((exercise, exIndex) => {
                  // A blank row is simply dropped on save — don't nag about it.
                  const named = exercise.name.trim().length > 0;
                  return (
                    <div
                      key={exIndex}
                      className="grid grid-cols-[1fr_3.5rem_4.5rem_2rem] items-center gap-1.5"
                    >
                      <Input
                        list="exercise-suggestions"
                        value={exercise.name}
                        placeholder={t.planBuilder.exercisePlaceholder}
                        className="h-8"
                        onChange={(e) =>
                          updateDay(dayIndex, {
                            exercises: day.exercises.map((ex, i) =>
                              i === exIndex
                                ? { ...ex, name: e.target.value }
                                : ex,
                            ),
                          })
                        }
                      />
                      <Input
                        inputMode="numeric"
                        value={exercise.sets}
                        aria-label={t.planBuilder.setsAria}
                        aria-invalid={named && !isPositiveInteger(exercise.sets)}
                        className="h-8 text-center"
                        onChange={(e) =>
                          updateDay(dayIndex, {
                            exercises: day.exercises.map((ex, i) =>
                              i === exIndex
                                ? { ...ex, sets: sanitizeInteger(e.target.value) }
                                : ex,
                            ),
                          })
                        }
                      />
                      <Input
                        inputMode="numeric"
                        value={exercise.reps}
                        aria-label={t.planBuilder.repsAria}
                        aria-invalid={named && !isValidRepRange(exercise.reps)}
                        className="h-8 text-center"
                        onChange={(e) =>
                          updateDay(dayIndex, {
                            exercises: day.exercises.map((ex, i) =>
                              i === exIndex
                                ? { ...ex, reps: sanitizeRepRange(e.target.value) }
                                : ex,
                            ),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        aria-label={t.planBuilder.removeExercise}
                        onClick={() =>
                          updateDay(dayIndex, {
                            exercises: day.exercises.filter(
                              (_, i) => i !== exIndex,
                            ),
                          })
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() =>
                    updateDay(dayIndex, {
                      exercises: [...day.exercises, emptyExercise()],
                    })
                  }
                >
                  <Plus className="size-4" /> {t.planBuilder.addExercise}
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="border-dashed"
            onClick={() =>
              setDays((prev) => [
                ...prev,
                {
                  name: fmt(t.planBuilder.dayDefault, {
                    number: prev.length + 1,
                  }),
                  exercises: [emptyExercise()],
                },
              ])
            }
          >
            <Plus className="size-4" /> {t.planBuilder.addDay}
          </Button>
        </div>

        <DialogFooter className="sm:items-center">
          {hasInvalidRow && (
            <p className="mr-auto text-sm text-destructive">
              {t.planBuilder.invalidNumbers}
            </p>
          )}
          <Button
            onClick={submit}
            disabled={saving || name.trim().length === 0 || hasInvalidRow}
          >
            {plan
              ? saving
                ? t.planBuilder.savingLabel
                : t.planBuilder.save
              : saving
                ? t.planBuilder.creating
                : t.planBuilder.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
