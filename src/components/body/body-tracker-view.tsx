"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { addBodyEntry, updateBodyEntry } from "@/lib/actions";
import { BODY_PHOTOS_BUCKET } from "@/lib/body-photos";
import { createClient } from "@/lib/supabase/client";
import { isPositiveDecimal } from "@/lib/validation";
import type { BodyEntryWithPhoto } from "@/lib/types";
import {
  BodyEntryForm,
  type BodyEntryDraft,
  type BodyPhotoAction,
} from "./body-entry-form";
import { BodyProgressChart } from "./body-progress-chart";
import { BodyHistoryList } from "./body-history-list";

function num(raw: string): number | undefined {
  return raw.trim() !== "" && isPositiveDecimal(raw) ? Number(raw) : undefined;
}

export function BodyTrackerView({
  userId,
  history,
}: {
  userId: string;
  history: BodyEntryWithPhoto[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [editingEntry, setEditingEntry] = useState<BodyEntryWithPhoto | null>(
    null,
  );

  function handleSave(draft: BodyEntryDraft, photo: BodyPhotoAction) {
    startSaving(async () => {
      let photoPath: string | null | undefined;
      if (photo.type === "remove") {
        photoPath = null;
      } else if (photo.type === "replace") {
        const supabase = createClient();
        const ext = photo.file.name.split(".").pop() || "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(BODY_PHOTOS_BUCKET)
          .upload(path, photo.file, { contentType: photo.file.type });
        if (error) {
          toast.error(t.bodyPage.photoUploadFailed);
          return;
        }
        photoPath = path;
      }

      const fields = {
        date: draft.date,
        heightCm: num(draft.heightCm),
        weightKg: num(draft.weightKg),
        waistCm: num(draft.waistCm),
        chestCm: num(draft.chestCm),
        thighCm: num(draft.thighCm),
        hipCm: num(draft.hipCm),
        notes: draft.notes.trim() || undefined,
      };

      const result = editingEntry
        ? await updateBodyEntry(editingEntry.id, { ...fields, photoPath })
        : await addBodyEntry({ ...fields, photoPath: photoPath ?? undefined });

      if (result.ok) {
        toast.success(editingEntry ? t.bodyPage.updated : t.bodyPage.saved);
        setEditingEntry(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <BodyEntryForm
        key={editingEntry?.id ?? "new"}
        saving={saving}
        editingEntry={editingEntry}
        onSave={handleSave}
        onCancelEdit={() => setEditingEntry(null)}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.bodyPage.progressTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyProgressChart history={history} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.bodyPage.historyTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyHistoryList entries={history} onEdit={setEditingEntry} />
        </CardContent>
      </Card>
    </div>
  );
}
