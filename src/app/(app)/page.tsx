import Link from "next/link";
import { ArrowRight, CalendarCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion";
import { StatCards, PrBadge } from "@/components/dashboard/stat-cards";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { requireUserId } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { formatShortDate, formatVolume } from "@/lib/overload";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const data = await getDashboardData(userId);
  const plannedToday = data.todaysEntries.filter((e) => e.status === "planned");

  return (
    <div className="space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.dashboard.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.dashboard.subtitle}
          </p>
        </div>
        <Button asChild>
          <Link href="/log">
            <Plus className="size-4" /> {t.dashboard.logWorkout}
          </Link>
        </Button>
      </FadeIn>

      {plannedToday.length > 0 && (
        <FadeIn delay={0.05}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <CalendarCheck className="size-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">
                    {fmt(t.dashboard.todaysPlan, {
                      labels: plannedToday.map((e) => e.label).join(" · "),
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {plannedToday[0].planName
                      ? fmt(t.dashboard.prefillFromPlan, {
                          plan: plannedToday[0].planName,
                        })
                      : t.dashboard.prefillScheduled}
                  </div>
                </div>
              </div>
              <Button asChild size="sm" variant="default">
                <Link href="/log">
                  {t.dashboard.startNow} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <StatCards
        workoutsThisWeek={data.workoutsThisWeek}
        volumeThisWeek={data.volumeThisWeek}
        volumeDeltaPct={data.volumeDeltaPct}
        streakDays={data.streakDays}
        prsLast30Days={data.prsLast30Days}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <FadeIn delay={0.1}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t.dashboard.weeklyVolume}
              </CardTitle>
              <CardDescription>{t.dashboard.weeklyVolumeDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <VolumeChart data={data.weeklyVolume} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t.dashboard.progressiveOverload}
              </CardTitle>
              <CardDescription>
                {t.dashboard.progressiveOverloadDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProgressChart
                trackedExercises={data.trackedExercises}
                progressByExercise={data.progressByExercise}
              />
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.2}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t.dashboard.recentWorkouts}
            </CardTitle>
            <CardDescription>{t.dashboard.recentWorkoutsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentWorkouts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t.dashboard.emptyRecent}
                </p>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/log">{t.dashboard.logFirstWorkout}</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {data.recentWorkouts.map((w) => {
                  const exerciseNames = [
                    ...new Set(w.sets.map((s) => s.exerciseName)),
                  ];
                  return (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{w.name}</span>
                          <PrBadge count={w.prCount} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {exerciseNames.slice(0, 4).join(" · ")}
                          {exerciseNames.length > 4 &&
                            ` · ${fmt(t.dashboard.moreExercises, {
                              count: exerciseNames.length - 4,
                            })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="outline">{formatVolume(w.volume)}</Badge>
                        <span className="tabular-nums">
                          {formatShortDate(w.date, locale)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
