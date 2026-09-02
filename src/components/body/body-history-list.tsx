"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Trash2 } from "lucide-react";
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
import { useI18n } from "@/components/i18n-provider";
import { deleteBodyEntry } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import { formatShortDate } from "@/lib/overload";
import type { BodyEntryWithPhoto } from "@/lib/types";

function MeasurementBadge({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  if (value == null) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{value}{unit}</span>
    </span>
  );
}

export function BodyHistoryList({
  entries,
  onEdit,
}: {
  entries: BodyEntryWithPhoto[];
  onEdit: (entry: BodyEntryWithPhoto) => void;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [confirming, setConfirming] = useState<BodyEntryWithPhoto | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<BodyEntryWithPhoto | null>(null);
  const [deleting, startDeleting] = useTransition();

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t.bodyPage.emptyHistory}
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 rounded-lg border p-3">
            {entry.photoUrl && (
              <button
                type="button"
                onClick={() => setViewingPhoto(entry)}
                aria-label={t.bodyPage.enlargePhoto}
                className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Image
                  src={entry.photoUrl}
                  alt={fmt(t.bodyPage.photoAlt, {
                    date: formatShortDate(entry.date, locale),
                  })}
                  width={64}
                  height={64}
                  className="size-16 cursor-pointer rounded-md object-cover"
                />
              </button>
            )}
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium tabular-nums">
                  {formatShortDate(entry.date, locale)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.bodyPage.editEntry}
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.bodyPage.deleteEntry}
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setConfirming(entry)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <MeasurementBadge
                  label={t.bodyPage.weight}
                  value={entry.weightKg}
                  unit={t.bodyPage.kg}
                />
                <MeasurementBadge
                  label={t.bodyPage.waist}
                  value={entry.waistCm}
                  unit={t.bodyPage.cm}
                />
                <MeasurementBadge
                  label={t.bodyPage.chest}
                  value={entry.chestCm}
                  unit={t.bodyPage.cm}
                />
                <MeasurementBadge
                  label={t.bodyPage.thigh}
                  value={entry.thighCm}
                  unit={t.bodyPage.cm}
                />
                <MeasurementBadge
                  label={t.bodyPage.hip}
                  value={entry.hipCm}
                  unit={t.bodyPage.cm}
                />
                <MeasurementBadge
                  label={t.bodyPage.height}
                  value={entry.heightCm}
                  unit={t.bodyPage.cm}
                />
              </div>
              {entry.notes && (
                <p className="text-sm text-muted-foreground">{entry.notes}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.bodyPage.deleteTitle}</DialogTitle>
            <DialogDescription>
              {fmt(t.bodyPage.deleteDesc, {
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
                  const result = await deleteBodyEntry(id);
                  if (result.ok) {
                    toast.success(t.bodyPage.deleted);
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

      <Dialog
        open={viewingPhoto !== null}
        onOpenChange={(open) => !open && setViewingPhoto(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {viewingPhoto
                ? fmt(t.bodyPage.photoAlt, {
                    date: formatShortDate(viewingPhoto.date, locale),
                  })
                : t.bodyPage.photo}
            </DialogTitle>
          </DialogHeader>
          {viewingPhoto?.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewingPhoto.photoUrl}
              alt={fmt(t.bodyPage.photoAlt, {
                date: formatShortDate(viewingPhoto.date, locale),
              })}
              className="max-h-[75vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
