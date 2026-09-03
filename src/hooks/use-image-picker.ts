"use client";

import { useState, type ChangeEvent } from "react";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/uploads";

export type ImagePickerAction =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; file: File };

/**
 * Owns the "pick an image, keep/replace/remove it" state machine shared by
 * body-entry photos and custom-exercise images. Never exposes the raw
 * file/preview/cleared fields — only the resolved `action` a caller hands to
 * its save mutation, and `displayedUrl` for rendering the preview.
 */
export function useImagePicker(options: {
  existingUrl: string | null;
  hasExisting: boolean;
  onInvalidType: () => void;
  onTooLarge: () => void;
}) {
  const { existingUrl, hasExisting, onInvalidType, onTooLarge } = options;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!picked) return;
    if (!ALLOWED_IMAGE_TYPES.includes(picked.type)) {
      onInvalidType();
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      onTooLarge();
      return;
    }
    setFile(picked);
    setCleared(false);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(picked);
    });
  }

  function onRemove() {
    setFile(null);
    setCleared(true);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  /** Returns to a pristine (non-cleared) state — for after a successful create. */
  function reset() {
    setFile(null);
    setCleared(false);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  const resolvedExistingUrl = !file && !cleared ? existingUrl : null;
  const displayedUrl = preview ?? resolvedExistingUrl;

  const action: ImagePickerAction = file
    ? { type: "replace", file }
    : hasExisting && cleared
      ? { type: "remove" }
      : { type: "keep" };

  return { displayedUrl, action, onChange, onRemove, reset };
}
