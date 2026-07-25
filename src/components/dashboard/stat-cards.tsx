"use client";

import { useEffect, useState } from "react";
import { useSpring } from "motion/react";
import { Dumbbell, Flame, TrendingDown, TrendingUp, Trophy, Weight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { Stagger, StaggerItem } from "@/components/motion";
import { formatVolume } from "@/lib/overload";

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const spring = useSpring(0, { stiffness: 90, damping: 22 });
  const [display, setDisplay] = useState(format ? format(0) : "0");

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) =>
      setDisplay(format ? format(v) : String(Math.round(v))),
    );
    spring.set(value);
    return unsubscribe;
  }, [spring, value, format]);

  return <span className="tabular-nums">{display}</span>;
}

export function StatCards({
  workoutsThisWeek,
  volumeThisWeek,
  volumeDeltaPct,
  streakDays,
  prsLast30Days,
}: {
  workoutsThisWeek: number;
  volumeThisWeek: number;
  volumeDeltaPct: number | null;
  streakDays: number;
  prsLast30Days: number;
}) {
  const { t } = useI18n();
  const stats = [
    {
      label: t.stats.workoutsThisWeek,
      icon: Dumbbell,
      content: <AnimatedNumber value={workoutsThisWeek} />,
      foot: t.stats.workoutsThisWeekFoot,
    },
    {
      label: t.stats.volumeThisWeek,
      icon: Weight,
      content: <AnimatedNumber value={volumeThisWeek} format={formatVolume} />,
      foot:
        volumeDeltaPct === null ? (
          t.stats.vsLastWeekNoData
        ) : (
          <span className="inline-flex items-center gap-1">
            {volumeDeltaPct >= 0 ? (
              <TrendingUp className="size-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="size-3.5 text-red-500" />
            )}
            {volumeDeltaPct >= 0 ? "+" : ""}
            {volumeDeltaPct}
            {t.stats.vsLastWeek}
          </span>
        ),
    },
    {
      label: t.stats.dayStreak,
      icon: Flame,
      content: <AnimatedNumber value={streakDays} />,
      foot: streakDays > 0 ? t.stats.streakKeep : t.stats.streakStart,
    },
    {
      label: t.stats.prsLast30Days,
      icon: Trophy,
      content: <AnimatedNumber value={prsLast30Days} />,
      foot: t.stats.prsFoot,
    },
  ];

  return (
    <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <StaggerItem key={stat.label}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-1.5 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wide">
                  {stat.label}
                </span>
                <stat.icon className="size-4" />
              </div>
              <div className="text-2xl font-semibold md:text-3xl">
                {stat.content}
              </div>
              <div className="mt-auto text-xs text-muted-foreground">
                {stat.foot}
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function PrBadge({ count }: { count: number }) {
  const { t } = useI18n();
  if (count <= 0) return null;
  return (
    <Badge className="gap-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400">
      <Trophy className="size-3" /> {count}{" "}
      {count > 1 ? t.stats.prPlural : t.stats.prSingular}
    </Badge>
  );
}
