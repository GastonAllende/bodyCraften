"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";
import { useImagePicker, type ImagePickerAction } from "@/hooks/use-image-picker";
import { todayIso } from "@/lib/overload";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";
import { isPositiveDecimal, sanitizeDecimal } from "@/lib/validation";
import type { BodyEntryWithPhoto } from "@/lib/types";

const MEASUREMENT_KEYS = [
  "heightCm",
  "weightKg",
  "waistCm",
  "chestCm",
  "thighCm",
  "hipCm",
] as const;

export type BodyEntryDraft = {
  date: string;
  heightCm: string;
  weightKg: string;
  waistCm: string;
  chestCm: string;
  thighCm: string;
  hipCm: string;
  notes: string;
};

/** `keep` and `remove` only apply when editing — a new entry has no existing photo. */
export type BodyPhotoAction = ImagePickerAction;

function emptyDraft(): BodyEntryDraft {
  return {
    date: todayIso(),
    heightCm: "",
    weightKg: "",
    waistCm: "",
    chestCm: "",
    thighCm: "",
    hipCm: "",
    notes: "",
  };
}

function draftFromEntry(entry: BodyEntryWithPhoto): BodyEntryDraft {
  return {
    date: entry.date,
    heightCm: entry.heightCm != null ? String(entry.heightCm) : "",
    weightKg: entry.weightKg != null ? String(entry.weightKg) : "",
    waistCm: entry.waistCm != null ? String(entry.waistCm) : "",
    chestCm: entry.chestCm != null ? String(entry.chestCm) : "",
    thighCm: entry.thighCm != null ? String(entry.thighCm) : "",
    hipCm: entry.hipCm != null ? String(entry.hipCm) : "",
    notes: entry.notes ?? "",
  };
}

/**
 * Keyed by `editingEntry?.id` from the container so switching which entry is
 * being edited (or leaving edit mode) remounts this component instead of
 * needing an effect to re-seed local state from a changed prop.
 */
export function BodyEntryForm({
  saving,
  editingEntry,
  onSave,
  onCancelEdit,
}: {
  saving: boolean;
  editingEntry?: BodyEntryWithPhoto | null;
  onSave: (draft: BodyEntryDraft, photo: BodyPhotoAction) => void;
  onCancelEdit?: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<BodyEntryDraft>(() =>
    editingEntry ? draftFromEntry(editingEntry) : emptyDraft(),
  );
  const photo = useImagePicker({
    existingUrl: editingEntry?.photoUrl ?? null,
    hasExisting: Boolean(editingEntry),
    onInvalidType: () => toast.error(t.bodyPage.photoInvalidType),
    onTooLarge: () => toast.error(t.bodyPage.photoTooLarge),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setMeasurement(
    key: (typeof MEASUREMENT_KEYS)[number],
    value: string,
  ) {
    setDraft((d) => ({ ...d, [key]: sanitizeDecimal(value) }));
  }

  const hasAnyMeasurement = MEASUREMENT_KEYS.some(
    (k) => draft[k].trim() !== "",
  );
  const hasInvalidMeasurement = MEASUREMENT_KEYS.some(
    (k) => draft[k].trim() !== "" && !isPositiveDecimal(draft[k]),
  );
  const canSave =
    Boolean(draft.date) &&
    (hasAnyMeasurement || photo.displayedUrl != null) &&
    !hasInvalidMeasurement;

  function handleSubmit() {
    if (!canSave) return;
    onSave(draft, photo.action);
    if (!editingEntry) {
      setDraft(emptyDraft());
      photo.reset();
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {editingEntry ? t.bodyPage.editEntry : t.bodyPage.logEntry}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="body-date">{t.bodyPage.date}</Label>
          <Input
            id="body-date"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            className="h-9 w-full sm:w-48"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["heightCm", t.bodyPage.height, t.bodyPage.cm],
              ["weightKg", t.bodyPage.weight, t.bodyPage.kg],
              ["waistCm", t.bodyPage.waist, t.bodyPage.cm],
              ["chestCm", t.bodyPage.chest, t.bodyPage.cm],
              ["thighCm", t.bodyPage.thigh, t.bodyPage.cm],
              ["hipCm", t.bodyPage.hip, t.bodyPage.cm],
            ] as const
          ).map(([key, label, unit]) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={`body-${key}`}>
                {label} ({unit})
              </Label>
              <Input
                id={`body-${key}`}
                inputMode="decimal"
                placeholder="0"
                value={draft[key]}
                onChange={(e) => setMeasurement(key, e.target.value)}
                className="tabular-nums"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="body-notes">{t.bodyPage.notes}</Label>
          <Textarea
            id="body-notes"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder={t.bodyPage.notesPlaceholder}
            rows={2}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>{t.bodyPage.photo}</Label>
          {photo.displayedUrl ? (
            <div className="relative w-28">
              {/* Local blob previews and signed Storage URLs both skip next/image here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.displayedUrl}
                alt=""
                className="size-28 rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={photo.onRemove}
                aria-label={t.bodyPage.removePhoto}
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
              <ImagePlus className="size-4" /> {t.bodyPage.photo}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={photo.onChange}
          />
          <p className="text-xs text-muted-foreground">{t.bodyPage.photoHint}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={!canSave || saving}>
            {saving
              ? t.bodyPage.saving
              : editingEntry
                ? t.bodyPage.saveChanges
                : t.bodyPage.save}
          </Button>
          {editingEntry && (
            <Button variant="outline" onClick={onCancelEdit} disabled={saving}>
              {t.common.cancel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
