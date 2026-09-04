"use client";

import { Button } from "@/components/ui/button";
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
import type { LibraryExercise } from "@/lib/types";
import { label } from "./exercise-utils";

export function ExerciseRemoveDialog({
  exercise,
  removing,
  onOpenChange,
  onConfirm,
}: {
  exercise: LibraryExercise | null;
  removing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (exercise: LibraryExercise) => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={exercise !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {exercise && fmt(t.exercisesPage.removeTitle, { name: label(exercise) })}
          </DialogTitle>
          <DialogDescription>{t.exercisesPage.removeDesc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={removing}
            onClick={() => exercise && onConfirm(exercise)}
          >
            {removing ? t.common.deleting : t.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
