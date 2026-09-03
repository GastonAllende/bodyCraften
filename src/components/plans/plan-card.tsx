"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, Sparkles, Trash2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import type { PlanWithDays } from "@/lib/types";
import { PlanBuilderDialog } from "./plan-builder-dialog";

export function PlanCard({
  plan,
  exerciseNames,
  deleting,
  onSchedule,
  onChanged,
  onDelete,
}: {
  plan: PlanWithDays;
  exerciseNames: string[];
  deleting: boolean;
  onSchedule: (planDayId: number) => void;
  onChanged: () => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<"confirm" | "edit" | null>(null);
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
              onClick={() => setDialog("edit")}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label={fmt(t.plansPage.deletePlanAria, { name: plan.name })}
              onClick={() => setDialog("confirm")}
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
      {dialog === "edit" && (
        <PlanBuilderDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          exerciseNames={exerciseNames}
          plan={plan}
          onSaved={onChanged}
        />
      )}

      <Dialog
        open={dialog === "confirm"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {fmt(t.plansPage.deletePlanTitle, { name: plan.name })}
            </DialogTitle>
            <DialogDescription>{t.plansPage.deletePlanDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => onDelete(plan.id)}
            >
              {deleting ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
