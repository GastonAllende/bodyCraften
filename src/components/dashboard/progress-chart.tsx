"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n/config";
import { formatShortDate } from "@/lib/overload";
import type { ExerciseProgressPoint } from "@/lib/types";

/** Points are keyed `date#workoutId` to keep same-day sessions apart. */
function sessionDate(sessionKey: string) {
  return sessionKey.split("#")[0];
}

export function ProgressChart({
  trackedExercises,
  progressByExercise,
}: {
  trackedExercises: string[];
  progressByExercise: Record<string, ExerciseProgressPoint[]>;
}) {
  const { locale, t } = useI18n();
  const [selected, setSelected] = useState(trackedExercises[0] ?? "");
  const points = progressByExercise[selected] ?? [];

  const chartConfig = {
    bestE1rm: { label: t.charts.e1rmLabel, color: "var(--chart-1)" },
    topWeight: { label: t.charts.topSetLabel, color: "var(--chart-2)" },
  } satisfies ChartConfig;

  if (trackedExercises.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {t.charts.progressEmpty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder={t.charts.pickExercise} />
        </SelectTrigger>
        <SelectContent>
          {trackedExercises.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {points.length < 2 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {fmt(t.charts.logOneMore, { name: selected })}
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <LineChart data={points} margin={{ left: -22, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="sessionKey"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              tickFormatter={(v: string) => formatShortDate(sessionDate(v), locale)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              fontSize={11}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    formatShortDate(sessionDate(String(value)), locale)
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="bestE1rm"
              stroke="var(--color-bestE1rm)"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive
              animationDuration={600}
            />
            <Line
              type="monotone"
              dataKey="topWeight"
              stroke="var(--color-topWeight)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive
              animationDuration={600}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
