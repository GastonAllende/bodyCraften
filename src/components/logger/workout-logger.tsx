"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ClipboardList, Dumbbell, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { saveWorkout } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import { todayIso } from "@/lib/overload";
import type {
  LastSessionHints,
  LibraryExercise,
  ScheduledDayPrefill,
} from "@/lib/types";
import { ExercisePickerDialog } from "./exercise-picker-dialog";
import { parseNum, type SetRow } from "./exercise-set-row";
import { LoggedExerciseCard, type LoggedExercise } from "./logged-exercise-card";
import { WorkoutSummaryBar } from "./workout-summary-bar";

function newKey() {
  return Math.random().toString(36).slice(2);
}

export function WorkoutLogger({
  library,
  hints,
  prefills,
}: {
  library: LibraryExercise[];
  hints: LastSessionHints;
  prefills: ScheduledDayPrefill[];
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [workoutName, setWorkoutName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [scheduleEntryId, setScheduleEntryId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, startSaving] = useTransition();

  const started = exercises.length > 0;

  const totalVolume = useMemo(
    () =>
      exercises.reduce(
        (sum, e) =>
          sum +
          e.sets.reduce(
            (s, set) => s + parseNum(set.weight) * parseNum(set.reps),
            0,
          ),
        0,
      ),
    [exercises],
  );
  const completedSets = exercises.reduce(
    (n, e) => n + e.sets.filter((s) => parseNum(s.reps) > 0).length,
    0,
  );

  function defaultRowsFor(name: string, plannedSets?: number): SetRow[] {
    const hint = hints[name];
    const count = plannedSets ?? hint?.sets.length ?? 3;
    return Array.from({ length: Math.max(1, count) }, (_, i) => {
      const prev = hint?.sets[i] ?? hint?.sets[hint.sets.length - 1];
      return {
        weight: prev ? String(prev.weightKg) : "",
        reps: prev ? String(prev.reps) : "",
        done: false,
      };
    });
  }

  function addExercise(name: string) {
    setExercises((prev) => [
      ...prev,
      { key: newKey(), name, sets: defaultRowsFor(name) },
    ]);
    setPickerOpen(false);
    setQuery("");
  }

  function removeExercise(key: string) {
    setExercises((prev) => prev.filter((e) => e.key !== key));
  }

  function startFromPrefill(prefill: ScheduledDayPrefill) {
    setScheduleEntryId(prefill.entryId);
    setWorkoutName(prefill.label);
    setExercises(
      prefill.exercises.map((e) => ({
        key: newKey(),
        name: e.name,
        targetReps: e.reps,
        sets: defaultRowsFor(e.name, e.sets),
      })),
    );
  }

  function updateSet(
    exerciseKey: string,
    index: number,
    patch: Partial<SetRow>,
  ) {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exerciseKey
          ? {
              ...e,
              sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)),
            }
          : e,
      ),
    );
  }

  function addSet(exerciseKey: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exerciseKey
          ? { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1], done: false }] }
          : e,
      ),
    );
  }

  function discard() {
    setExercises([]);
    setScheduleEntryId(null);
    setWorkoutName("");
  }

  function finishWorkout() {
    const payload = {
      date,
      name:
        workoutName.trim() ||
        fmt(t.logger.defaultName, {
          weekday: new Date().toLocaleDateString(locale, { weekday: "long" }),
        }),
      scheduleEntryId: scheduleEntryId ?? undefined,
      exercises: exercises.map((e) => ({
        name: e.name,
        sets: e.sets
          .map((s) => ({ weightKg: parseNum(s.weight), reps: parseNum(s.reps) }))
          .filter((s) => s.reps > 0),
      })),
    };

    startSaving(async () => {
      const result = await saveWorkout(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.prExercises.length > 0) {
        toast.success(
          fmt(t.logger.newPr, { names: result.data.prExercises.join(", ") }),
          { description: t.logger.newPrDesc },
        );
      } else {
        toast.success(t.logger.workoutSaved);
      }
      setExercises([]);
      setWorkoutName("");
      setScheduleEntryId(null);
      setDate(todayIso());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!started && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Dumbbell className="size-6" />
            </span>
            <div>
              <h2 className="font-medium">{t.logger.readyTitle}</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {t.logger.readyDesc}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {prefills.map((p) => (
                <Button key={p.entryId} onClick={() => startFromPrefill(p)}>
                  <ClipboardList className="size-4" />
                  {fmt(t.logger.startPrefill, { label: p.label })}
                </Button>
              ))}
              <Button
                variant={prefills.length > 0 ? "secondary" : "default"}
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-4" /> {t.logger.emptyWorkout}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {started && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder={t.logger.workoutNamePlaceholder}
                className="h-9 w-full sm:max-w-56"
              />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full sm:w-40"
                aria-label={t.logger.workoutDate}
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={discard}
              >
                <X className="size-4" /> {t.logger.discard}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence initial={false}>
              {exercises.map((exercise) => (
                <LoggedExerciseCard
                  key={exercise.key}
                  exercise={exercise}
                  hint={hints[exercise.name]}
                  onRemove={() => removeExercise(exercise.key)}
                  onUpdateSet={(index, patch) =>
                    updateSet(exercise.key, index, patch)
                  }
                  onAddSet={() => addSet(exercise.key)}
                />
              ))}
            </AnimatePresence>

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-4" /> {t.logger.addExercise}
            </Button>
          </CardContent>
        </Card>
      )}

      {started && (
        <WorkoutSummaryBar
          totalVolume={totalVolume}
          completedSets={completedSets}
          saving={saving}
          onFinish={finishWorkout}
        />
      )}

      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        library={library}
        query={query}
        onQueryChange={setQuery}
        onSelect={addExercise}
      />
    </div>
  );
}
