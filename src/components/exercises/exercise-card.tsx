"use client";

import { motion } from "motion/react";
import { BookmarkCheck, BookmarkPlus, BookmarkX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import type { LibraryExercise } from "@/lib/types";
import { isOwned, label } from "./exercise-utils";

export function ExerciseCard({
  exercise,
  saving,
  onOpenDetail,
  onSaveRemote,
  onRemove,
}: {
  exercise: LibraryExercise;
  saving: boolean;
  onOpenDetail: () => void;
  onSaveRemote: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card
        className="h-full cursor-pointer transition-colors hover:border-primary/40"
        onClick={onOpenDetail}
      >
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium leading-snug">{label(exercise)}</span>
            {exercise.remote ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground"
                aria-label={fmt(t.exercisesPage.saveToLibraryAria, {
                  name: label(exercise),
                })}
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveRemote();
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
                aria-label={fmt(t.exercisesPage.removeFromLibraryAria, {
                  name: label(exercise),
                })}
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
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
              {t.exercisesPage.bodyParts[exercise.bodyPart] ?? exercise.bodyPart}
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
  );
}
