"use client";

import { Plus } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import type { LibraryExercise } from "@/lib/types";

export function ExercisePickerDialog({
  open,
  onOpenChange,
  library,
  query,
  onQueryChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: LibraryExercise[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (name: string) => void;
}) {
  const { t } = useI18n();
  const trimmed = query.trim();
  const canCreate =
    trimmed.length > 1 &&
    !library.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.logger.pickerTitle}
      description={t.logger.pickerDesc}
    >
      <Command>
        <CommandInput
          placeholder={t.logger.searchPlaceholder}
          value={query}
          onValueChange={onQueryChange}
        />
        <CommandList>
          <CommandEmpty>{t.logger.noExerciseFound}</CommandEmpty>
          {canCreate && (
            <CommandGroup heading={t.logger.createGroup}>
              <CommandItem
                value={`create-${query}`}
                onSelect={() => onSelect(trimmed)}
              >
                <Plus className="size-4" />
                {fmt(t.logger.addAsNew, { name: trimmed })}
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading={t.logger.libraryGroup}>
            {library.map((exercise) => (
              <CommandItem
                key={exercise.name}
                value={exercise.name}
                onSelect={() => onSelect(exercise.name)}
              >
                <span className="truncate">{exercise.name}</span>
                <span className="ml-auto text-xs capitalize text-muted-foreground">
                  {exercise.bodyPart}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
