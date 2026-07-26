"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { resetWorkoutHistory } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";

export function ResetHistoryCard({
  history,
}: {
  history: { workouts: number; sets: number };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, startResetting] = useTransition();
  const isEmpty = history.workouts === 0;

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" /> {t.settingsPage.dangerZone}
        </CardTitle>
        <CardDescription>{t.settingsPage.resetHistoryTitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t.settingsPage.resetHistoryDesc}
        </p>
        <p className="text-sm font-medium tabular-nums">
          {isEmpty
            ? t.settingsPage.nothingToReset
            : fmt(t.settingsPage.currentData, {
                workouts: history.workouts,
                sets: history.sets,
              })}
        </p>
        <Button
          variant="destructive"
          disabled={isEmpty}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" /> {t.settingsPage.resetButton}
        </Button>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.settingsPage.confirmTitle}</DialogTitle>
            <DialogDescription>
              {fmt(t.settingsPage.confirmDesc, {
                workouts: history.workouts,
                sets: history.sets,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={resetting}
              onClick={() =>
                startResetting(async () => {
                  const result = await resetWorkoutHistory();
                  if (result.ok) {
                    toast.success(
                      fmt(t.settingsPage.resetDone, {
                        count: result.data.deleted,
                      }),
                    );
                    setConfirmOpen(false);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              {resetting
                ? t.settingsPage.resetting
                : t.settingsPage.confirmCta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
