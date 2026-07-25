"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrBadge } from "@/components/dashboard/stat-cards";
import { useI18n } from "@/components/i18n-provider";
import { deleteWorkout } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import { formatShortDate, formatVolume } from "@/lib/overload";
import type { WorkoutWithSets } from "@/lib/types";

export function HistoryList({ workouts }: { workouts: WorkoutWithSets[] }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [confirming, setConfirming] = useState<WorkoutWithSets | null>(null);
  const [deleting, startDeleting] = useTransition();

  if (workouts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t.history.empty}
      </p>
    );
  }

  return (
    <>
      <Accordion type="multiple" className="w-full">
        {workouts.map((w) => {
          const byExercise = new Map<string, typeof w.sets>();
          for (const set of w.sets) {
            const list = byExercise.get(set.exerciseName) ?? [];
            list.push(set);
            byExercise.set(set.exerciseName, list);
          }
          return (
            <AccordionItem key={w.id} value={String(w.id)}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    <PrBadge count={w.prCount} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{formatVolume(w.volume)}</Badge>
                    <span className="tabular-nums">
                      {formatShortDate(w.date, locale)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {[...byExercise.entries()].map(([name, sets]) => (
                    <div key={name}>
                      <div className="text-sm font-medium">{name}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {sets.map((s) => (
                          <Badge
                            key={s.id}
                            variant={s.isPr ? "default" : "secondary"}
                            className="tabular-nums"
                          >
                            {s.weightKg}kg × {s.reps}
                            {s.isPr ? " 🏆" : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {w.notes && (
                    <p className="text-sm text-muted-foreground">{w.notes}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setConfirming(w)}
                  >
                    <Trash2 className="size-4" /> {t.history.deleteWorkout}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.history.deleteTitle}</DialogTitle>
            <DialogDescription>
              {fmt(t.history.deleteDesc, {
                name: confirming?.name ?? "",
                date: confirming ? formatShortDate(confirming.date, locale) : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                if (!confirming) return;
                const id = confirming.id;
                startDeleting(async () => {
                  const result = await deleteWorkout(id);
                  if (result.ok) {
                    toast.success(t.history.deleted);
                    setConfirming(null);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              {deleting ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
