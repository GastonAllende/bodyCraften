"use client";

import Link from "next/link";
import { Check, Play, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";
import { todayIso } from "@/lib/overload";
import { cn } from "@/lib/utils";
import type { ScheduleEntryView } from "@/lib/types";

export type ScheduleStatus = "planned" | "done" | "skipped";

export function ScheduleChip({
  entry,
  onStatusChange,
  onRemove,
}: {
  entry: ScheduleEntryView;
  onStatusChange: (id: number, status: ScheduleStatus) => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useI18n();
  const isToday = entry.date === todayIso();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
            entry.status === "done" &&
              "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            entry.status === "planned" && "bg-primary/10 text-primary",
            entry.status === "skipped" &&
              "bg-muted text-muted-foreground line-through",
          )}
        >
          {entry.label}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {entry.status === "planned" && isToday && (
          <DropdownMenuItem asChild>
            <Link href="/log">
              <Play className="size-4" /> {t.plansPage.startInLogger}
            </Link>
          </DropdownMenuItem>
        )}
        {entry.status !== "done" && (
          <DropdownMenuItem onClick={() => onStatusChange(entry.id, "done")}>
            <Check className="size-4" /> {t.plansPage.markDone}
          </DropdownMenuItem>
        )}
        {entry.status !== "skipped" && (
          <DropdownMenuItem onClick={() => onStatusChange(entry.id, "skipped")}>
            <X className="size-4" /> {t.plansPage.markSkipped}
          </DropdownMenuItem>
        )}
        {entry.status !== "planned" && (
          <DropdownMenuItem onClick={() => onStatusChange(entry.id, "planned")}>
            {t.plansPage.resetToPlanned}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onRemove(entry.id)}
        >
          <Trash2 className="size-4" /> {t.plansPage.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
