"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  BookmarkCheck,
  BookmarkPlus,
  BookmarkX,
  Pencil,
  Plus,
  Search,
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
import { useI18n } from "@/components/i18n-provider";
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
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "@/lib/types";
import { ExerciseFormDialog, type ExerciseDraft } from "./exercise-form-dialog";

const PAGE_SIZE = 48;

type ExerciseDialog =
  | { type: "detail"; exercise: LibraryExercise }
  | { type: "remove"; exercise: LibraryExercise }
  | { type: "form"; target: LibraryExercise | "new" };

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
  const [dialog, setDialog] = useState<ExerciseDialog | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [, startSaving] = useTransition();
  const [savingExercise, startSavingExercise] = useTransition();

  const detailExercise = dialog?.type === "detail" ? dialog.exercise : null;
  const removingExercise = dialog?.type === "remove" ? dialog.exercise : null;
  const formTarget = dialog?.type === "form" ? dialog.target : null;

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
        <Button
          variant="secondary"
          onClick={() => setDialog({ type: "form", target: "new" })}
        >
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
                onClick={() => setDialog({ type: "detail", exercise })}
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
                          setDialog({ type: "remove", exercise });
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
        open={detailExercise !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailExercise && label(detailExercise)}</DialogTitle>
            <DialogDescription className="capitalize">
              {detailExercise
                ? (t.exercisesPage.bodyParts[detailExercise.bodyPart] ??
                  detailExercise.bodyPart)
                : null}{" "}
              · {detailExercise?.equipment} · {t.exercisesPage.targets}{" "}
              {detailExercise?.target}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-muted-foreground">
            {detailExercise?.imageUrl && (
              // Signed Storage URLs skip next/image here, same as body photos.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detailExercise.imageUrl}
                alt=""
                className="w-full rounded-md border object-cover"
              />
            )}
            {detailExercise?.instructionSteps?.length ? (
              <div className="space-y-1.5">
                <h3 className="font-medium text-foreground">
                  {t.exercisesPage.howToTitle}
                </h3>
                <ol className="list-decimal space-y-1 pl-5">
                  {detailExercise.instructionSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>
                {detailExercise?.instructions || t.exercisesPage.noInstructions}
              </p>
            )}
          </div>
          {detailExercise && (detailExercise.remote || isOwned(detailExercise)) && (
            <DialogFooter>
              {detailExercise.remote ? (
                <Button
                  onClick={() => {
                    saveRemote(detailExercise);
                    setDialog(null);
                  }}
                >
                  <BookmarkPlus className="size-4" />{" "}
                  {t.exercisesPage.saveToMyLibrary}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() =>
                      // Hand over to the edit dialog rather than stacking two.
                      setDialog({ type: "form", target: detailExercise })
                    }
                  >
                    <Pencil className="size-4" /> {t.exercisesPage.edit}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      // Hand over to the confirm dialog rather than stacking two.
                      setDialog({ type: "remove", exercise: detailExercise })
                    }
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
        open={removingExercise !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {removingExercise &&
                fmt(t.exercisesPage.removeTitle, {
                  name: label(removingExercise),
                })}
            </DialogTitle>
            <DialogDescription>
              {t.exercisesPage.removeDesc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={
                removingExercise !== null && savingName === removingExercise.name
              }
              onClick={() => removingExercise && confirmRemove(removingExercise)}
            >
              {removingExercise !== null && savingName === removingExercise.name
                ? t.common.deleting
                : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
