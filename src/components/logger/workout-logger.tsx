"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CheckCheck,
  ClipboardList,
  Copy,
  Dumbbell,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { saveWorkout } from "@/lib/actions";
import { formatShortDate, formatVolume, todayIso } from "@/lib/overload";
import { cn } from "@/lib/utils";
import type {
  LastSessionHints,
  LibraryExercise,
  ScheduledDayPrefill,
} from "@/lib/types";

type SetRow = { weight: string; reps: string; done: boolean };
type LoggedExercise = {
  key: string;
  name: string;
  targetReps?: string;
  sets: SetRow[];
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

function parseNum(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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

  function finishWorkout() {
    const payload = {
      date,
      name:
        workoutName.trim() ||
        `${new Date().toLocaleDateString(undefined, { weekday: "long" })} workout`,
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
          `New PR on ${result.data.prExercises.join(", ")}! 🏆`,
          { description: "Estimated 1RM beat your previous best." },
        );
      } else {
        toast.success("Workout saved. Nice session! 💪");
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
              <h2 className="font-medium">Ready to train?</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Start from today&apos;s scheduled plan or build the session as
                you go. Last session&apos;s numbers appear next to every set —
                beat them.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {prefills.map((p) => (
                <Button key={p.entryId} onClick={() => startFromPrefill(p)}>
                  <ClipboardList className="size-4" />
                  Start “{p.label}”
                </Button>
              ))}
              <Button
                variant={prefills.length > 0 ? "secondary" : "default"}
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-4" /> Empty workout
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
                placeholder="Workout name (e.g. Push Day)"
                className="h-9 w-full sm:max-w-56"
              />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full sm:w-40"
                aria-label="Workout date"
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => {
                  setExercises([]);
                  setScheduleEntryId(null);
                  setWorkoutName("");
                }}
              >
                <X className="size-4" /> Discard
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence initial={false}>
              {exercises.map((exercise) => {
                const hint = hints[exercise.name];
                return (
                  <motion.div
                    key={exercise.key}
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
                              target {exercise.targetReps} reps
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {hint
                            ? `Last time (${formatShortDate(hint.date)}): ${hint.sets
                                .map((s) => `${s.weightKg}×${s.reps}`)
                                .join("  ")}`
                            : "First time logging this — set your baseline."}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        aria-label={`Remove ${exercise.name}`}
                        onClick={() =>
                          setExercises((prev) =>
                            prev.filter((e) => e.key !== exercise.key),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="grid grid-cols-[2rem_1fr_1fr_2.25rem] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[2.5rem_5rem_1fr_1fr_2.25rem]">
                        <span>Set</span>
                        <span className="hidden sm:block">Prev</span>
                        <span>kg</span>
                        <span>Reps</span>
                        <span />
                      </div>
                      {exercise.sets.map((set, i) => {
                        const prev = hint?.sets[i];
                        const filled = parseNum(set.reps) > 0;
                        return (
                          <div
                            key={i}
                            className="grid grid-cols-[2rem_1fr_1fr_2.25rem] items-center gap-2 sm:grid-cols-[2.5rem_5rem_1fr_1fr_2.25rem]"
                          >
                            <span className="text-center text-sm text-muted-foreground tabular-nums">
                              {i + 1}
                            </span>
                            <button
                              type="button"
                              className="hidden truncate rounded px-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
                              title="Copy last session's set"
                              onClick={() =>
                                prev &&
                                updateSet(exercise.key, i, {
                                  weight: String(prev.weightKg),
                                  reps: String(prev.reps),
                                })
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
                              onChange={(e) =>
                                updateSet(exercise.key, i, {
                                  weight: e.target.value,
                                })
                              }
                              className="h-9 text-center tabular-nums"
                              aria-label={`${exercise.name} set ${i + 1} weight`}
                            />
                            <Input
                              inputMode="numeric"
                              placeholder={prev ? String(prev.reps) : "0"}
                              value={set.reps}
                              onChange={(e) =>
                                updateSet(exercise.key, i, {
                                  reps: e.target.value,
                                })
                              }
                              className="h-9 text-center tabular-nums"
                              aria-label={`${exercise.name} set ${i + 1} reps`}
                            />
                            <Button
                              type="button"
                              variant={set.done ? "default" : "outline"}
                              size="icon"
                              className={cn(
                                "size-9",
                                set.done &&
                                  "bg-emerald-600 text-white hover:bg-emerald-600/90",
                              )}
                              aria-label="Mark set done"
                              onClick={() => {
                                if (!set.done && !filled && prev) {
                                  updateSet(exercise.key, i, {
                                    weight: String(prev.weightKg),
                                    reps: String(prev.reps),
                                    done: true,
                                  });
                                } else {
                                  updateSet(exercise.key, i, {
                                    done: !set.done,
                                  });
                                }
                              }}
                            >
                              <Check className="size-4" />
                            </Button>
                          </div>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 text-muted-foreground"
                        onClick={() =>
                          setExercises((prev) =>
                            prev.map((e) =>
                              e.key === exercise.key
                                ? {
                                    ...e,
                                    sets: [
                                      ...e.sets,
                                      { ...e.sets[e.sets.length - 1], done: false },
                                    ],
                                  }
                                : e,
                            ),
                          )
                        }
                      >
                        <Plus className="size-4" /> Add set
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="size-4" /> Add exercise
            </Button>
          </CardContent>
        </Card>
      )}

      {started && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-20 z-30 md:bottom-4"
        >
          <Card className="border-primary/20 shadow-lg">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-4 pl-1 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Volume</div>
                  <div className="font-semibold tabular-nums">
                    {formatVolume(totalVolume)}
                  </div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <div className="text-xs text-muted-foreground">Sets</div>
                  <div className="font-semibold tabular-nums">{completedSets}</div>
                </div>
              </div>
              <Button
                size="lg"
                onClick={finishWorkout}
                disabled={saving || completedSets === 0}
              >
                <CheckCheck className="size-4" />
                {saving ? "Saving…" : "Finish workout"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <CommandDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Add exercise"
        description="Search your exercise library"
      >
        <Command>
          <CommandInput
            placeholder="Search exercises…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
          <CommandEmpty>No exercise found.</CommandEmpty>
          {query.trim().length > 1 &&
            !library.some(
              (e) => e.name.toLowerCase() === query.trim().toLowerCase(),
            ) && (
              <CommandGroup heading="Create">
                <CommandItem
                  value={`create-${query}`}
                  onSelect={() => addExercise(query.trim())}
                >
                  <Plus className="size-4" />
                  Add “{query.trim()}” as a new exercise
                </CommandItem>
              </CommandGroup>
            )}
          <CommandGroup heading="Library">
            {library.map((exercise) => (
              <CommandItem
                key={exercise.name}
                value={exercise.name}
                onSelect={() => addExercise(exercise.name)}
              >
                <span className="truncate">{exercise.name}</span>
                <span className="ml-auto text-xs capitalize text-muted-foreground">
                  {exercise.bodyPart}
                </span>
              </CommandItem>
            ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
}
