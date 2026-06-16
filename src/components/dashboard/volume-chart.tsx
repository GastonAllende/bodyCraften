"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatVolume } from "@/lib/overload";

const chartConfig = {
  volume: { label: "Volume (kg)", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function VolumeChart({
  data,
}: {
  data: { week: string; volume: number }[];
}) {
  const hasData = data.some((d) => d.volume > 0);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Log a few workouts and your weekly training volume will show up here.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <BarChart data={data} margin={{ left: -14, right: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={11}
          tickFormatter={(v: number) => formatVolume(v)}
        />
        <ChartTooltip cursor={{ fillOpacity: 0.1 }} content={<ChartTooltipContent />} />
        <Bar
          dataKey="volume"
          fill="var(--color-volume)"
          radius={[6, 6, 0, 0]}
          isAnimationActive
          animationDuration={600}
        />
      </BarChart>
    </ChartContainer>
  );
}
