"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  BookmarkCheck,
  BookmarkPlus,
  BookmarkX,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import {
  addCustomExercise,
  importExercise,
  removeExercise,
} from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "@/lib/types";

const PAGE_SIZE = 48;

/**
 * What the user reads. `name` stays canonical English because it is the key the
 * logger and plans write to the DB — only the label is translated.
 */
function label(exercise: LibraryExercise): string {
  return exercise.displayName ?? exercise.name;
}

/** A saved row carries a DB id; catalog-only rows are flagged `remote`. */
function isSaved(exercise: LibraryExercise): boolean {
  return !exercise.remote;
}

export function ExerciseBrowser({ exercises }: { exercises: LibraryExercise[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "saved">("all");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LibraryExercise | null>(null);
  const [, startSaving] = useTransition();

  const saved = useMemo(() => exercises.filter(isSaved), [exercises]);
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
        <AddCustomExerciseDialog onAdded={() => router.refresh()} />
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
                    ) : (
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
          {selected && (
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

function AddCustomExerciseDialog({ onAdded }: { onAdded: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [target, setTarget] = useState("");
  const [saving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = await addCustomExercise({
        name,
        bodyPart,
        equipment,
        target,
      });
      if (result.ok) {
        toast.success(fmt(t.exercisesPage.added, { name: name.trim() }));
        setOpen(false);
        setName("");
        setBodyPart("");
        setEquipment("");
        setTarget("");
        onAdded();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus className="size-4" /> {t.exercisesPage.newExercise}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.exercisesPage.addCustomTitle}</DialogTitle>
          <DialogDescription>{t.exercisesPage.addCustomDesc}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ex-name">{t.exercisesPage.name}</Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.exercisesPage.namePlaceholder}
            />
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
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || name.trim().length < 2}>
            {saving ? t.exercisesPage.adding : t.exercisesPage.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
