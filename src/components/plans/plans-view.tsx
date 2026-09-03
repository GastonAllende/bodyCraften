"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CalendarPlus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import {
  deletePlan,
  deleteScheduleEntry,
  updateScheduleStatus,
} from "@/lib/actions";
import { formatWeekday, parseIsoDate, todayIso } from "@/lib/overload";
import { cn } from "@/lib/utils";
import type { PlanWithDays, ScheduleEntryView } from "@/lib/types";
import { PlanBuilderDialog } from "./plan-builder-dialog";
import { PlanCard } from "./plan-card";
import { ScheduleChip, type ScheduleStatus } from "./schedule-chip";
import { ScheduleDialog, type DayOption } from "./schedule-dialog";

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
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [, startDeletePlan] = useTransition();
  const [, startScheduleUpdate] = useTransition();

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

  function handleDeletePlan(id: number) {
    setDeletingPlanId(id);
    startDeletePlan(async () => {
      const result = await deletePlan(id);
      setDeletingPlanId(null);
      if (result.ok) {
        toast.success(t.plansPage.planDeleted);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleStatusChange(id: number, status: ScheduleStatus) {
    startScheduleUpdate(async () => {
      await updateScheduleStatus(id, status);
      router.refresh();
    });
  }

  function handleRemoveEntry(id: number) {
    startScheduleUpdate(async () => {
      await deleteScheduleEntry(id);
      router.refresh();
    });
  }

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
                      onStatusChange={handleStatusChange}
                      onRemove={handleRemoveEntry}
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
                  deleting={deletingPlanId === plan.id}
                  onSchedule={(planDayId) => setScheduleFor({ planDayId })}
                  onChanged={() => router.refresh()}
                  onDelete={handleDeletePlan}
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

      {scheduleFor && (
        <ScheduleDialog
          key={`${scheduleFor.date ?? ""}-${scheduleFor.planDayId ?? ""}`}
          state={scheduleFor}
          onOpenChange={(open) => !open && setScheduleFor(null)}
          dayOptions={dayOptions}
          onScheduled={() => router.refresh()}
        />
      )}
    </div>
  );
}
