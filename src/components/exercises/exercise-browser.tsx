"use client";

import { useRef, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  BookmarkCheck,
  BookmarkPlus,
  BookmarkX,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  addCustomExercise,
  importExercise,
  removeExercise,
  updateExercise,
} from "@/lib/actions";
import { EXERCISE_IMAGES_BUCKET } from "@/lib/exercise-images";
import { fmt } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "@/lib/types";

const PAGE_SIZE = 48;

/** `keep` and `remove` only apply when editing — a new exercise has no existing image. */
type ExerciseImageAction =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; file: File };

/**
 * What the user reads. `name` stays canonical English because it is the key the
 * logger and plans write to the DB — only the label is translated.
 */
function label(exercise: LibraryExercise): string {
  return exercise.displayName ?? exercise.name;
}

/**
 * Only rows the user actually owns (`custom`/`api` source) can be removed —
 * `built-in` rows are the shared catalog (`user_id IS NULL`) and
 * `removeExercise` scopes its DELETE to `user_id = userId`, so it can never
 * match one. Same rows define "Saved": the shared catalog is always usable
 * for logging, but "Saved" means "I added this," not "this exists."
 */
function isOwned(exercise: LibraryExercise): boolean {
  return !exercise.remote && exercise.source !== "built-in";
}

export function ExerciseBrowser({
  exercises,
  userId,
}: {
  exercises: LibraryExercise[];
  userId: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "saved">("all");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LibraryExercise | null>(null);
  const [formTarget, setFormTarget] = useState<LibraryExercise | "new" | null>(
    null,
  );
  const [, startSaving] = useTransition();

  const saved = useMemo(() => exercises.filter(isOwned), [exercises]);
  const scoped = scope === "saved" ? saved : exercises;

  const bodyParts = useMemo(
    () => [...new Set(scoped.map((e) => e.bodyPart.toLowerCase()))].sort(),
    [scoped],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((e) => {
      if (bodyPart && e.bodyPart.toLowerCase() !== bodyPart) return false;
      if (!q) return true;
      // Match the translated label as well as the canonical name, so a Spanish
      // user searching "sentadilla" finds the exercise stored as "Squat".
      return (
        label(e).toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [scoped, query, bodyPart]);

  const visible = filtered.slice(0, limit);

  function changeScope(next: "all" | "saved") {
    setScope(next);
    // The body-part chips are derived from the scope, so an active one may not
    // exist on the other side of the toggle.
    setBodyPart(null);
    setLimit(PAGE_SIZE);
  }

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
        toast.success(fmt(t.exercisesPage.savedToLibrary, {
          name: label(exercise),
        }));
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
      setRemoving(null);
      if (result.ok) {
        toast.success(fmt(t.exercisesPage.removed, { name: label(exercise) }));
        // The card either vanishes (custom) or reverts to a catalog row, so drop
        // the detail dialog rather than leave it showing a stale exercise.
        setSelected(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder={t.exercisesPage.searchPlaceholder}
            className="pl-8"
          />
        </div>
        <Button variant="secondary" onClick={() => setFormTarget("new")}>
          <Plus className="size-4" /> {t.exercisesPage.newExercise}
        </Button>
      </div>

      <div className="flex w-full max-w-sm rounded-lg border p-1">
        <ScopeTab
          label={t.exercisesPage.scopeAll}
          active={scope === "all"}
          onClick={() => changeScope("all")}
        />
        <ScopeTab
          label={fmt(t.exercisesPage.scopeSaved, { count: saved.length })}
          active={scope === "saved"}
          onClick={() => changeScope("saved")}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label={t.exercisesPage.all}
          active={bodyPart === null}
          onClick={() => setBodyPart(null)}
        />
        {bodyParts.map((part) => (
          <FilterChip
            key={part}
            label={t.exercisesPage.bodyParts[part] ?? part}
            active={bodyPart === part}
            onClick={() => {
              setBodyPart(bodyPart === part ? null : part);
              setLimit(PAGE_SIZE);
            }}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length}{" "}
        {filtered.length === 1
          ? t.exercisesPage.exerciseSingular
          : t.exercisesPage.exercisePlural}
      </p>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {scope === "saved"
              ? saved.length === 0
                ? t.exercisesPage.emptyLibrary
                : t.exercisesPage.noLibraryMatches
              : t.exercisesPage.noMatches}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((exercise) => (
            <motion.div
              key={exercise.name}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
            >
              <Card
                className="h-full cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => setSelected(exercise)}
              >
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-snug">
                      {label(exercise)}
                    </span>
                    {exercise.remote ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label={fmt(t.exercisesPage.saveToLibraryAria, {
                          name: label(exercise),
                        })}
                        disabled={savingName === exercise.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          saveRemote(exercise);
                        }}
                      >
                        <BookmarkPlus className="size-4" />
                      </Button>
                    ) : isOwned(exercise) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="group/bookmark size-7 shrink-0 text-primary hover:text-destructive"
                        title={t.exercisesPage.inLibrary}
                        aria-label={fmt(
                          t.exercisesPage.removeFromLibraryAria,
                          { name: label(exercise) },
                        )}
                        disabled={savingName === exercise.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemoving(exercise);
                        }}
                      >
                        <BookmarkCheck className="size-4 group-hover/bookmark:hidden" />
                        <BookmarkX className="hidden size-4 group-hover/bookmark:block" />
                      </Button>
                    ) : (
                      <span
                        className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                        title={t.exercisesPage.inLibrary}
                      >
                        <BookmarkCheck className="size-4" />
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="capitalize">
                      {t.exercisesPage.bodyParts[exercise.bodyPart] ??
                        exercise.bodyPart}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {exercise.equipment}
                    </Badge>
                    {exercise.source === "custom" && (
                      <Badge className="bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400">
                        {t.exercisesPage.customBadge}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
          >
            {fmt(t.exercisesPage.showMore, { count: filtered.length - limit })}
          </Button>
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected && label(selected)}</DialogTitle>
            <DialogDescription className="capitalize">
              {selected
                ? (t.exercisesPage.bodyParts[selected.bodyPart] ??
                  selected.bodyPart)
                : null}{" "}
              · {selected?.equipment} · {t.exercisesPage.targets}{" "}
              {selected?.target}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-muted-foreground">
            {selected?.imageUrl && (
              // Signed Storage URLs skip next/image here, same as body photos.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl}
                alt=""
                className="w-full rounded-md border object-cover"
              />
            )}
            {selected?.instructionSteps?.length ? (
              <div className="space-y-1.5">
                <h3 className="font-medium text-foreground">
                  {t.exercisesPage.howToTitle}
                </h3>
                <ol className="list-decimal space-y-1 pl-5">
                  {selected.instructionSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>{selected?.instructions || t.exercisesPage.noInstructions}</p>
            )}
          </div>
          {selected && (selected.remote || isOwned(selected)) && (
            <DialogFooter>
              {selected.remote ? (
                <Button
                  onClick={() => {
                    saveRemote(selected);
                    setSelected(null);
                  }}
                >
                  <BookmarkPlus className="size-4" />{" "}
                  {t.exercisesPage.saveToMyLibrary}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Hand over to the edit dialog rather than stacking two.
                      setSelected(null);
                      setFormTarget(selected);
                    }}
                  >
                    <Pencil className="size-4" /> {t.exercisesPage.edit}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      // Hand over to the confirm dialog rather than stacking two.
                      setSelected(null);
                      setRemoving(selected);
                    }}
                  >
                    <BookmarkX className="size-4" />{" "}
                    {t.exercisesPage.removeFromLibrary}
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {removing &&
                fmt(t.exercisesPage.removeTitle, { name: label(removing) })}
            </DialogTitle>
            <DialogDescription>
              {t.exercisesPage.removeDesc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={removing !== null && savingName === removing.name}
              onClick={() => removing && confirmRemove(removing)}
            >
              {removing !== null && savingName === removing.name
                ? t.common.deleting
                : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExerciseFormDialog
        key={formTarget === "new" || formTarget === null ? "new" : formTarget.id}
        userId={userId}
        exercise={formTarget === "new" ? null : formTarget}
        open={formTarget !== null}
        onOpenChange={(open) => !open && setFormTarget(null)}
        onSaved={() => {
          setFormTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function ScopeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Add/edit dialog for an owned exercise. `exercise` present means edit mode:
 * name renders as static text (it's the join key for logged sets and plan
 * entries — see `ExerciseUpdateInput` — so it can't be changed here) and
 * submit calls `updateExercise` instead of `addCustomExercise`.
 */
function ExerciseFormDialog({
  userId,
  exercise,
  open,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  exercise: LibraryExercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(exercise?.name ?? "");
  const [bodyPart, setBodyPart] = useState(exercise?.bodyPart ?? "");
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [target, setTarget] = useState(exercise?.target ?? "");
  const [instructions, setInstructions] = useState(exercise?.instructions ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCleared, setImageCleared] = useState(false);
  const [saving, startSaving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t.exercisesPage.imageInvalidType);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t.exercisesPage.imageTooLarge);
      return;
    }
    setImageFile(file);
    setImageCleared(false);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function removeImage() {
    setImageFile(null);
    setImageCleared(true);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  const existingImageUrl =
    !imageFile && !imageCleared ? (exercise?.imageUrl ?? null) : null;
  const displayedImage = imagePreview ?? existingImageUrl;

  function submit() {
    startSaving(async () => {
      const imageAction: ExerciseImageAction = imageFile
        ? { type: "replace", file: imageFile }
        : exercise && imageCleared
          ? { type: "remove" }
          : { type: "keep" };

      let imagePath: string | null | undefined;
      if (imageAction.type === "remove") {
        imagePath = null;
      } else if (imageAction.type === "replace") {
        const supabase = createClient();
        const ext = imageAction.file.name.split(".").pop() || "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(EXERCISE_IMAGES_BUCKET)
          .upload(path, imageAction.file, { contentType: imageAction.file.type });
        if (error) {
          toast.error(t.exercisesPage.imageUploadFailed);
          return;
        }
        imagePath = path;
      }

      const fields = {
        bodyPart,
        equipment,
        target,
        instructions: instructions.trim() || undefined,
      };

      const result = exercise
        ? await updateExercise(exercise.id!, { ...fields, imagePath })
        : await addCustomExercise({
            name,
            ...fields,
            imagePath: imagePath ?? undefined,
          });

      if (result.ok) {
        toast.success(
          exercise
            ? fmt(t.exercisesPage.updated, { name: label(exercise) })
            : fmt(t.exercisesPage.added, { name: name.trim() }),
        );
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
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
            {displayedImage ? (
              <div className="relative w-28">
                {/* Local blob previews and signed Storage URLs both skip next/image here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayedImage}
                  alt=""
                  className="size-28 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
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
              onChange={handleImageChange}
            />
            <p className="text-xs text-muted-foreground">{t.exercisesPage.imageHint}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || name.trim().length < 2}>
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
