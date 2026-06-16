"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BookmarkCheck, BookmarkPlus, Info, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { addCustomExercise, importExercise } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "@/lib/types";

const PAGE_SIZE = 48;

export function ExerciseBrowser({
  exercises,
  source,
  apiError,
}: {
  exercises: LibraryExercise[];
  source: "api" | "built-in";
  apiError?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [, startSaving] = useTransition();

  const bodyParts = useMemo(
    () =>
      [...new Set(exercises.map((e) => e.bodyPart.toLowerCase()))].sort(),
    [exercises],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (bodyPart && e.bodyPart.toLowerCase() !== bodyPart) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [exercises, query, bodyPart]);

  const visible = filtered.slice(0, limit);

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
        toast.success(`“${exercise.name}” saved to your library.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {source === "built-in" && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>
            {apiError ? "Exercise API unreachable" : "Built-in catalog active"}
          </AlertTitle>
          <AlertDescription>
            {apiError
              ? `Couldn't reach ExerciseDB (${apiError}). Showing the built-in catalog instead.`
              : "Showing the built-in catalog. Add EXERCISEDB_API_KEY to .env.local to browse 1,300+ exercises from the ExerciseDB API — instructions in README."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search by name, muscle or equipment…"
            className="pl-8"
          />
        </div>
        <AddCustomExerciseDialog onAdded={() => router.refresh()} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label="All"
          active={bodyPart === null}
          onClick={() => setBodyPart(null)}
        />
        {bodyParts.map((part) => (
          <FilterChip
            key={part}
            label={part}
            active={bodyPart === part}
            onClick={() => {
              setBodyPart(bodyPart === part ? null : part);
              setLimit(PAGE_SIZE);
            }}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
        {source === "api" && " · live from ExerciseDB"}
      </p>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing matches that search — try another term or add it as a
            custom exercise.
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
                      {exercise.name}
                    </span>
                    {exercise.remote ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label={`Save ${exercise.name} to library`}
                        disabled={savingName === exercise.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          saveRemote(exercise);
                        }}
                      >
                        <BookmarkPlus className="size-4" />
                      </Button>
                    ) : (
                      <BookmarkCheck
                        className="size-4 shrink-0 text-primary"
                        aria-label="In your library"
                      />
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="capitalize">
                      {exercise.bodyPart}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {exercise.equipment}
                    </Badge>
                    {exercise.source === "custom" && (
                      <Badge className="bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400">
                        custom
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
            Show more ({filtered.length - limit} left)
          </Button>
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription className="capitalize">
              {selected?.bodyPart} · {selected?.equipment} · targets{" "}
              {selected?.target}
            </DialogDescription>
          </DialogHeader>
          <p className="max-h-64 overflow-y-auto text-sm leading-relaxed text-muted-foreground">
            {selected?.instructions ||
              "No instructions stored for this exercise. Focus on controlled reps and full range of motion."}
          </p>
          {selected?.remote && (
            <DialogFooter>
              <Button
                onClick={() => {
                  saveRemote(selected);
                  setSelected(null);
                }}
              >
                <BookmarkPlus className="size-4" /> Save to my library
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
        toast.success(`“${name.trim()}” added to your library.`);
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
          <Plus className="size-4" /> New exercise
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a custom exercise</DialogTitle>
          <DialogDescription>
            It will be available in the logger and plan builder.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landmine Press"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ex-body">Body part</Label>
              <Input
                id="ex-body"
                value={bodyPart}
                onChange={(e) => setBodyPart(e.target.value)}
                placeholder="shoulders"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ex-equipment">Equipment</Label>
              <Input
                id="ex-equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="barbell"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ex-target">Target muscle</Label>
            <Input
              id="ex-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="front delts"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || name.trim().length < 2}>
            {saving ? "Adding…" : "Add exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
