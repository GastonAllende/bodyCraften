"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
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
import { formatShortDate } from "@/lib/overload";
import type { BodyEntryWithPhoto } from "@/lib/types";

type MetricKey = "weightKg" | "waistCm" | "chestCm" | "thighCm" | "hipCm";

export function BodyProgressChart({ history }: { history: BodyEntryWithPhoto[] }) {
  const { locale, t } = useI18n();
  const metrics: { key: MetricKey; label: string; unit: string }[] = [
    { key: "weightKg", label: t.bodyPage.weight, unit: t.bodyPage.kg },
    { key: "waistCm", label: t.bodyPage.waist, unit: t.bodyPage.cm },
    { key: "chestCm", label: t.bodyPage.chest, unit: t.bodyPage.cm },
    { key: "thighCm", label: t.bodyPage.thigh, unit: t.bodyPage.cm },
    { key: "hipCm", label: t.bodyPage.hip, unit: t.bodyPage.cm },
  ];
  const [metric, setMetric] = useState<MetricKey>("weightKg");
  const active = metrics.find((m) => m.key === metric)!;

  const points = useMemo(
    () =>
      [...history]
        .filter((e) => e[metric] != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ date: e.date, value: e[metric] as number })),
    [history, metric],
  );

  const chartConfig = {
    value: { label: `${active.label} (${active.unit})`, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <div className="space-y-3">
      <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder={t.bodyPage.pickMetric} />
        </SelectTrigger>
        <SelectContent>
          {metrics.map((m) => (
            <SelectItem key={m.key} value={m.key}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {points.length < 2 ? (
        <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {t.bodyPage.metricEmpty}
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
              tickFormatter={(v: string) => formatShortDate(v, locale)}
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
                  labelFormatter={(value) => formatShortDate(String(value), locale)}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive
              animationDuration={600}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
