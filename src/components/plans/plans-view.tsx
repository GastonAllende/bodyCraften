"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import {
  createPlan,
  deletePlan,
  deleteScheduleEntry,
  scheduleWorkout,
  updatePlan,
  updateScheduleStatus,
} from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import {
  formatWeekday,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "@/lib/overload";
import { cn } from "@/lib/utils";
import {
  isPositiveInteger,
  isValidRepRange,
  sanitizeInteger,
  sanitizeRepRange,
} from "@/lib/validation";
import type {
  PlanInput,
  PlanWithDays,
  ScheduleEntryView,
} from "@/lib/types";

type DayOption = { id: number; label: string };

export function PlansView({
  plans,
  schedule,
  exerciseNames,
}: {
  plans: PlanWithDays[];
  schedule: { date: string; entries: ScheduleEntryView[] }[];
  exerciseNames: string[];
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<{
    date?: string;
    planDayId?: number;
  } | null>(null);

  const dayOptions: DayOption[] = useMemo(
    () =>
      plans.flatMap((plan) =>
        plan.days.map((day) => ({
          id: day.id,
          label: `${plan.name} — ${day.name}`,
        })),
      ),
    [plans],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">{t.plansPage.scheduleHeading}</h2>
            <p className="text-xs text-muted-foreground">
              {t.plansPage.scheduleHint}
            </p>
          </div>
          <Button size="sm" onClick={() => setScheduleFor({})}>
            <CalendarPlus className="size-4" /> {t.plansPage.scheduleButton}
          </Button>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="grid w-max min-w-full grid-cols-7 gap-1.5 md:w-full">
            {schedule.map(({ date, entries }) => {
              const isToday = date === todayIso();
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setScheduleFor({ date })}
                  className={cn(
                    "flex min-h-20 w-20 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors hover:border-primary/50 md:w-auto",
                    isToday && "border-primary ring-1 ring-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {formatWeekday(date, locale)} {parseIsoDate(date).getDate()}
                  </span>
                  {entries.map((entry) => (
                    <ScheduleChip
                      key={entry.id}
                      entry={entry}
                      onChanged={() => router.refresh()}
                    />
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">{t.plansPage.myPlans}</h2>
            <p className="text-xs text-muted-foreground">
              {t.plansPage.myPlansHint}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setBuilderOpen(true)}>
            <Plus className="size-4" /> {t.plansPage.newPlan}
          </Button>
        </div>

        {plans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                {t.plansPage.emptyPlans}
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setBuilderOpen(true)}>
                  <Plus className="size-4" /> {t.plansPage.buildPlan}
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/generate">
                    <Sparkles className="size-4" /> {t.plansPage.generateWithAi}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <PlanCard
                  plan={plan}
                  exerciseNames={exerciseNames}
                  onSchedule={(planDayId) => setScheduleFor({ planDayId })}
                  onChanged={() => router.refresh()}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <PlanBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        exerciseNames={exerciseNames}
        onSaved={() => router.refresh()}
      />

      <ScheduleDialog
        state={scheduleFor}
        onOpenChange={(open) => !open && setScheduleFor(null)}
        dayOptions={dayOptions}
        onScheduled={() => router.refresh()}
      />
    </div>
  );
}

function ScheduleChip({
  entry,
  onChanged,
}: {
  entry: ScheduleEntryView;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [, startUpdate] = useTransition();
  const isToday = entry.date === todayIso();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
            entry.status === "done" &&
              "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            entry.status === "planned" && "bg-primary/10 text-primary",
            entry.status === "skipped" &&
              "bg-muted text-muted-foreground line-through",
          )}
        >
          {entry.label}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {entry.status === "planned" && isToday && (
          <DropdownMenuItem asChild>
            <Link href="/log">
              <Play className="size-4" /> {t.plansPage.startInLogger}
            </Link>
          </DropdownMenuItem>
        )}
        {entry.status !== "done" && (
          <DropdownMenuItem
            onClick={() =>
              startUpdate(async () => {
                await updateScheduleStatus(entry.id, "done");
                onChanged();
              })
            }
          >
            <Check className="size-4" /> {t.plansPage.markDone}
          </DropdownMenuItem>
        )}
        {entry.status !== "skipped" && (
          <DropdownMenuItem
            onClick={() =>
              startUpdate(async () => {
                await updateScheduleStatus(entry.id, "skipped");
                onChanged();
              })
            }
          >
            <X className="size-4" /> {t.plansPage.markSkipped}
          </DropdownMenuItem>
        )}
        {entry.status !== "planned" && (
          <DropdownMenuItem
            onClick={() =>
              startUpdate(async () => {
                await updateScheduleStatus(entry.id, "planned");
                onChanged();
              })
            }
          >
            {t.plansPage.resetToPlanned}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            startUpdate(async () => {
              await deleteScheduleEntry(entry.id);
              onChanged();
            })
          }
        >
          <Trash2 className="size-4" /> {t.plansPage.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlanCard({
  plan,
  exerciseNames,
  onSchedule,
  onChanged,
}: {
  plan: PlanWithDays;
  exerciseNames: string[];
  onSchedule: (planDayId: number) => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();
  const totalExercises = plan.days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{plan.name}</CardTitle>
            <CardDescription>
              {plan.days.length}{" "}
              {plan.days.length === 1
                ? t.plansPage.daySingular
                : t.plansPage.dayPlural}{" "}
              · {fmt(t.plansPage.exercisesCount, { count: totalExercises })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {plan.source === "ai" && (
              <Badge className="gap-1 bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400">
                <Sparkles className="size-3" /> AI
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={fmt(t.plansPage.editPlanAria, { name: plan.name })}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={fmt(t.plansPage.deletePlanAria, { name: plan.name })}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        {plan.description && (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {plan.days.map((day) => (
            <AccordionItem key={day.id} value={String(day.id)}>
              <AccordionTrigger className="py-2.5 text-sm hover:no-underline">
                <span className="flex flex-1 items-center justify-between pr-2">
                  {day.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {fmt(t.plansPage.exercisesCount, {
                      count: day.exercises.length,
                    })}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5">
                  {day.exercises.map((exercise) => (
                    <li
                      key={exercise.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{exercise.exerciseName}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {exercise.sets} × {exercise.reps}
                        {exercise.restSec
                          ? ` · ${fmt(t.plansPage.restSuffix, {
                              sec: exercise.restSec,
                            })}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => onSchedule(day.id)}
                >
                  <CalendarPlus className="size-4" /> {t.plansPage.scheduleThisDay}
                </Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>

      {/* Mounted only while open so it always seeds from the current plan. */}
      {editOpen && (
        <PlanBuilderDialog
          open
          onOpenChange={setEditOpen}
          exerciseNames={exerciseNames}
          plan={plan}
          onSaved={onChanged}
        />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {fmt(t.plansPage.deletePlanTitle, { name: plan.name })}
            </DialogTitle>
            <DialogDescription>{t.plansPage.deletePlanDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() =>
                startDeleting(async () => {
                  const result = await deletePlan(plan.id);
                  if (result.ok) {
                    toast.success(t.plansPage.planDeleted);
                    onChanged();
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              {deleting ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

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

function PlanBuilderDialog({
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

function ScheduleDialog({
  state,
  onOpenChange,
  dayOptions,
  onScheduled,
}: {
  state: { date?: string; planDayId?: number } | null;
  onOpenChange: (open: boolean) => void;
  dayOptions: DayOption[];
  onScheduled: () => void;
}) {
  const { locale, t } = useI18n();
  const open = state !== null;
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [selection, setSelection] = useState<string>("custom");
  const [customLabel, setCustomLabel] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  // Sync defaults each time the dialog opens with a different context.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state) {
      setDate(state.date ? parseIsoDate(state.date) : new Date());
      setSelection(state.planDayId != null ? String(state.planDayId) : "custom");
    }
  }

  function submit() {
    if (!date) return;
    const planDayId = selection === "custom" ? null : Number(selection);
    const label =
      selection === "custom"
        ? customLabel.trim() || t.common.workout
        : (dayOptions.find((d) => d.id === planDayId)?.label.split(" — ")[1] ??
          t.common.workout);

    startSaving(async () => {
      const result = await scheduleWorkout({
        date: toIsoDate(date),
        planDayId,
        label,
      });
      if (result.ok) {
        toast.success(
          fmt(t.scheduleDialog.scheduled, {
            label,
            date: date.toLocaleDateString(locale, {
              weekday: "long",
              month: "short",
              day: "numeric",
            }),
          }),
        );
        onOpenChange(false);
        setCustomLabel("");
        onScheduled();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.scheduleDialog.title}</DialogTitle>
          <DialogDescription>{t.scheduleDialog.desc}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t.scheduleDialog.date}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between font-normal">
                  {date
                    ? date.toLocaleDateString(locale, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : t.scheduleDialog.pickDate}
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-1.5">
            <Label>{t.scheduleDialog.workout}</Label>
            <Select value={selection} onValueChange={setSelection}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">
                  {t.scheduleDialog.customOption}
                </SelectItem>
                {dayOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selection === "custom" && (
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-label">{t.scheduleDialog.label}</Label>
              <Input
                id="schedule-label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder={t.scheduleDialog.labelPlaceholder}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving || !date}>
            {saving ? t.scheduleDialog.submitting : t.scheduleDialog.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
