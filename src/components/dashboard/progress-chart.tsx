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
import { formatShortDate } from "@/lib/overload";
import type { ExerciseProgressPoint } from "@/lib/types";

const chartConfig = {
  bestE1rm: { label: "Est. 1RM (kg)", color: "var(--chart-1)" },
  topWeight: { label: "Top set (kg)", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ProgressChart({
  trackedExercises,
  progressByExercise,
}: {
  trackedExercises: string[];
  progressByExercise: Record<string, ExerciseProgressPoint[]>;
}) {
  const [selected, setSelected] = useState(trackedExercises[0] ?? "");
  const points = progressByExercise[selected] ?? [];

  if (trackedExercises.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Once you log an exercise more than once, its strength curve appears
        here — that&apos;s your progressive overload at a glance.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Pick an exercise" />
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
          Log {selected} one more time to draw a trend line.
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <LineChart data={points} margin={{ left: -22, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              tickFormatter={(v: string) => formatShortDate(v)}
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
                  labelFormatter={(value) => formatShortDate(String(value))}
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
