"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";
import { useImagePicker, type ImagePickerAction } from "@/hooks/use-image-picker";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";
import type { LibraryExercise } from "@/lib/types";

export type ExerciseDraft = {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  instructions?: string;
};

/**
 * Add/edit dialog for an owned exercise. `exercise` present means edit mode:
 * name renders as static text (it's the join key for logged sets and plan
 * entries — see `ExerciseUpdateInput` — so it can't be changed here).
 *
 * Presentational: the Storage upload and the add/update action call are the
 * container's job (`ExerciseBrowser`'s `handleSaveExercise`) — this dialog
 * only collects the draft and image action and hands both to `onSave`.
 */
export function ExerciseFormDialog({
  exercise,
  open,
  onOpenChange,
  saving,
  onSave,
}: {
  exercise: LibraryExercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (draft: ExerciseDraft, image: ImagePickerAction) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(exercise?.name ?? "");
  const [bodyPart, setBodyPart] = useState(exercise?.bodyPart ?? "");
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [target, setTarget] = useState(exercise?.target ?? "");
  const [instructions, setInstructions] = useState(exercise?.instructions ?? "");
  const image = useImagePicker({
    existingUrl: exercise?.imageUrl ?? null,
    hasExisting: Boolean(exercise),
    onInvalidType: () => toast.error(t.exercisesPage.imageInvalidType),
    onTooLarge: () => toast.error(t.exercisesPage.imageTooLarge),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    onSave(
      {
        name,
        bodyPart,
        equipment,
        target,
        instructions: instructions.trim() || undefined,
      },
      image.action,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {exercise ? t.exercisesPage.editCustomTitle : t.exercisesPage.addCustomTitle}
          </DialogTitle>
          <DialogDescription>
            {exercise ? t.exercisesPage.editCustomDesc : t.exercisesPage.addCustomDesc}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ex-name">{t.exercisesPage.name}</Label>
            {exercise ? (
              <p className="text-sm font-medium">{name}</p>
            ) : (
              <Input
                id="ex-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.exercisesPage.namePlaceholder}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ex-body">{t.exercisesPage.bodyPart}</Label>
              <Input
                id="ex-body"
                value={bodyPart}
                onChange={(e) => setBodyPart(e.target.value)}
                placeholder={t.exercisesPage.bodyPartPlaceholder}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ex-equipment">{t.exercisesPage.equipment}</Label>
              <Input
                id="ex-equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder={t.exercisesPage.equipmentPlaceholder}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ex-target">{t.exercisesPage.targetMuscle}</Label>
            <Input
              id="ex-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t.exercisesPage.targetPlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ex-instructions">{t.exercisesPage.instructionsLabel}</Label>
            <Textarea
              id="ex-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t.exercisesPage.instructionsPlaceholder}
              rows={4}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t.exercisesPage.imageLabel}</Label>
            {image.displayedUrl ? (
              <div className="relative w-28">
                {/* Local blob previews and signed Storage URLs both skip next/image here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.displayedUrl}
                  alt=""
                  className="size-28 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={image.onRemove}
                  aria-label={t.exercisesPage.removeImage}
                  className="absolute -right-2 -top-2 rounded-full border bg-background p-1 shadow-sm"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-4" /> {t.exercisesPage.imageLabel}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={image.onChange}
            />
            <p className="text-xs text-muted-foreground">{t.exercisesPage.imageHint}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={saving || name.trim().length < 2}>
            {saving
              ? exercise
                ? t.exercisesPage.saving
                : t.exercisesPage.adding
              : exercise
                ? t.exercisesPage.saveChanges
                : t.exercisesPage.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
