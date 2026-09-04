"use client";

import { BookmarkPlus, BookmarkX, Pencil } from "lucide-react";
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
import type { LibraryExercise } from "@/lib/types";
import { isOwned, label } from "./exercise-utils";

export function ExerciseDetailDialog({
  exercise,
  onOpenChange,
  onSaveRemote,
  onEdit,
  onRemove,
}: {
  exercise: LibraryExercise | null;
  onOpenChange: (open: boolean) => void;
  onSaveRemote: (exercise: LibraryExercise) => void;
  onEdit: (exercise: LibraryExercise) => void;
  onRemove: (exercise: LibraryExercise) => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={exercise !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exercise && label(exercise)}</DialogTitle>
          <DialogDescription className="capitalize">
            {exercise
              ? (t.exercisesPage.bodyParts[exercise.bodyPart] ?? exercise.bodyPart)
              : null}{" "}
            · {exercise?.equipment} · {t.exercisesPage.targets} {exercise?.target}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-muted-foreground">
          {exercise?.imageUrl && (
            // Signed Storage URLs skip next/image here, same as body photos.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={exercise.imageUrl}
              alt=""
              className="w-full rounded-md border object-cover"
            />
          )}
          {exercise?.instructionSteps?.length ? (
            <div className="space-y-1.5">
              <h3 className="font-medium text-foreground">
                {t.exercisesPage.howToTitle}
              </h3>
              <ol className="list-decimal space-y-1 pl-5">
                {exercise.instructionSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ) : (
            <p>{exercise?.instructions || t.exercisesPage.noInstructions}</p>
          )}
        </div>
        {exercise && (exercise.remote || isOwned(exercise)) && (
          <DialogFooter>
            {exercise.remote ? (
              <Button onClick={() => onSaveRemote(exercise)}>
                <BookmarkPlus className="size-4" /> {t.exercisesPage.saveToMyLibrary}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => onEdit(exercise)}>
                  <Pencil className="size-4" /> {t.exercisesPage.edit}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onRemove(exercise)}
                >
                  <BookmarkX className="size-4" /> {t.exercisesPage.removeFromLibrary}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
