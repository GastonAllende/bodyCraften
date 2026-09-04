"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { useExerciseFilters } from "@/hooks/use-exercise-filters";
import type { ImagePickerAction } from "@/hooks/use-image-picker";
import {
  addCustomExercise,
  importExercise,
  removeExercise,
  updateExercise,
} from "@/lib/actions";
import { EXERCISE_IMAGES_BUCKET } from "@/lib/exercise-images";
import { fmt } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import type { LibraryExercise } from "@/lib/types";
import { ExerciseCard } from "./exercise-card";
import { ExerciseDetailDialog } from "./exercise-detail-dialog";
import { ExerciseFilterBar } from "./exercise-filter-bar";
import { ExerciseFormDialog, type ExerciseDraft } from "./exercise-form-dialog";
import { ExerciseRemoveDialog } from "./exercise-remove-dialog";
import { label } from "./exercise-utils";

type ExerciseDialog =
  | { type: "detail"; exercise: LibraryExercise }
  | { type: "remove"; exercise: LibraryExercise }
  | { type: "form"; target: LibraryExercise | "new" };

export function ExerciseBrowser({
  exercises,
  userId,
}: {
  exercises: LibraryExercise[];
  userId: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const filters = useExerciseFilters(exercises);
  const [dialog, setDialog] = useState<ExerciseDialog | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [, startSaving] = useTransition();
  const [savingExercise, startSavingExercise] = useTransition();

  const detailExercise = dialog?.type === "detail" ? dialog.exercise : null;
  const removingExercise = dialog?.type === "remove" ? dialog.exercise : null;
  const formTarget = dialog?.type === "form" ? dialog.target : null;

  function saveRemote(exercise: LibraryExercise) {
    setSavingName(exercise.name);
    startSaving(async () => {
      const result = await importExercise({
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        equipment: exercise.equipment,
        target: exercise.target,
        instructions: exercise.instructions,
      });
      setSavingName(null);
      if (result.ok) {
        toast.success(
          fmt(t.exercisesPage.savedToLibrary, { name: label(exercise) }),
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function confirmRemove(exercise: LibraryExercise) {
    setSavingName(exercise.name);
    startSaving(async () => {
      const result = await removeExercise(exercise.name);
      setSavingName(null);
      setDialog(null);
      if (result.ok) {
        toast.success(fmt(t.exercisesPage.removed, { name: label(exercise) }));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSaveExercise(draft: ExerciseDraft, image: ImagePickerAction) {
    const target = formTarget;
    startSavingExercise(async () => {
      let imagePath: string | null | undefined;
      if (image.type === "remove") {
        imagePath = null;
      } else if (image.type === "replace") {
        const supabase = createClient();
        const ext = image.file.name.split(".").pop() || "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(EXERCISE_IMAGES_BUCKET)
          .upload(path, image.file, { contentType: image.file.type });
        if (error) {
          toast.error(t.exercisesPage.imageUploadFailed);
          return;
        }
        imagePath = path;
      }

      const fields = {
        bodyPart: draft.bodyPart,
        equipment: draft.equipment,
        target: draft.target,
        instructions: draft.instructions,
      };

      const result =
        target && target !== "new"
          ? await updateExercise(target.id!, { ...fields, imagePath })
          : await addCustomExercise({
              name: draft.name,
              ...fields,
              imagePath: imagePath ?? undefined,
            });

      if (result.ok) {
        toast.success(
          target && target !== "new"
            ? fmt(t.exercisesPage.updated, { name: label(target) })
            : fmt(t.exercisesPage.added, { name: draft.name.trim() }),
        );
        setDialog(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <ExerciseFilterBar
        query={filters.query}
        onQueryChange={filters.setQuery}
        onNewExercise={() => setDialog({ type: "form", target: "new" })}
        scope={filters.scope}
        onScopeChange={filters.changeScope}
        savedCount={filters.saved.length}
        bodyPart={filters.bodyPart}
        onBodyPartChange={filters.setBodyPart}
        bodyParts={filters.bodyParts}
      />

      <p className="text-xs text-muted-foreground">
        {filters.filtered.length}{" "}
        {filters.filtered.length === 1
          ? t.exercisesPage.exerciseSingular
          : t.exercisesPage.exercisePlural}
      </p>

      {filters.visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {filters.scope === "saved"
              ? filters.saved.length === 0
                ? t.exercisesPage.emptyLibrary
                : t.exercisesPage.noLibraryMatches
              : t.exercisesPage.noMatches}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filters.visible.map((exercise) => (
            <ExerciseCard
              key={exercise.name}
              exercise={exercise}
              saving={savingName === exercise.name}
              onOpenDetail={() => setDialog({ type: "detail", exercise })}
              onSaveRemote={() => saveRemote(exercise)}
              onRemove={() => setDialog({ type: "remove", exercise })}
            />
          ))}
        </div>
      )}

      {filters.filtered.length > filters.visible.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={filters.showMore}>
            {fmt(t.exercisesPage.showMore, {
              count: filters.filtered.length - filters.visible.length,
            })}
          </Button>
        </div>
      )}

      <ExerciseDetailDialog
        exercise={detailExercise}
        onOpenChange={(open) => !open && setDialog(null)}
        onSaveRemote={(exercise) => {
          saveRemote(exercise);
          setDialog(null);
        }}
        onEdit={(exercise) => setDialog({ type: "form", target: exercise })}
        onRemove={(exercise) => setDialog({ type: "remove", exercise })}
      />

      <ExerciseRemoveDialog
        exercise={removingExercise}
        removing={
          removingExercise !== null && savingName === removingExercise.name
        }
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={confirmRemove}
      />

      <ExerciseFormDialog
        key={formTarget === "new" || formTarget === null ? "new" : formTarget.id}
        exercise={formTarget === "new" ? null : formTarget}
        open={formTarget !== null}
        saving={savingExercise}
        onOpenChange={(open) => !open && setDialog(null)}
        onSave={handleSaveExercise}
      />
    </div>
  );
}
