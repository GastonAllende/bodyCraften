"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { scheduleWorkout } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import { parseIsoDate, toIsoDate } from "@/lib/overload";

export type DayOption = { id: number; label: string };

export function ScheduleDialog({
  state,
  onOpenChange,
  dayOptions,
  onScheduled,
}: {
  state: { date?: string; planDayId?: number };
  onOpenChange: (open: boolean) => void;
  dayOptions: DayOption[];
  onScheduled: () => void;
}) {
  const { locale, t } = useI18n();
  const [date, setDate] = useState<Date | undefined>(
    state.date ? parseIsoDate(state.date) : new Date(),
  );
  const [selection, setSelection] = useState<string>(
    state.planDayId != null ? String(state.planDayId) : "custom",
  );
  const [customLabel, setCustomLabel] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, startSaving] = useTransition();

  function submit() {
    if (!date) return;
    const planDayId = selection === "custom" ? null : Number(selection);
    const label =
      selection === "custom"
        ? customLabel.trim() || t.common.workout
        : (dayOptions.find((d) => d.id === planDayId)?.label.split(" — ")[1] ??
          t.common.workout);

    startSaving(async () => {
      const result = await scheduleWorkout({
        date: toIsoDate(date),
        planDayId,
        label,
      });
      if (result.ok) {
        toast.success(
          fmt(t.scheduleDialog.scheduled, {
            label,
            date: date.toLocaleDateString(locale, {
              weekday: "long",
              month: "short",
              day: "numeric",
            }),
          }),
        );
        onOpenChange(false);
        setCustomLabel("");
        onScheduled();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.scheduleDialog.title}</DialogTitle>
          <DialogDescription>{t.scheduleDialog.desc}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t.scheduleDialog.date}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between font-normal">
                  {date
                    ? date.toLocaleDateString(locale, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : t.scheduleDialog.pickDate}
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-1.5">
            <Label>{t.scheduleDialog.workout}</Label>
            <Select value={selection} onValueChange={setSelection}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">
                  {t.scheduleDialog.customOption}
                </SelectItem>
                {dayOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selection === "custom" && (
            <div className="grid gap-1.5">
              <Label htmlFor="schedule-label">{t.scheduleDialog.label}</Label>
              <Input
                id="schedule-label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder={t.scheduleDialog.labelPlaceholder}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving || !date}>
            {saving ? t.scheduleDialog.submitting : t.scheduleDialog.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
