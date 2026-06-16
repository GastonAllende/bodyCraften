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
import { getDashboardData } from "@/lib/queries";
import { formatShortDate, formatVolume } from "@/lib/overload";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = getDashboardData();
  const plannedToday = data.todaysEntries.filter((e) => e.status === "planned");

  return (
    <div className="space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track your training and keep the weights moving up.
          </p>
        </div>
        <Button asChild>
          <Link href="/log">
            <Plus className="size-4" /> Log workout
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
                    Today&apos;s plan: {plannedToday.map((e) => e.label).join(" · ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {plannedToday[0].planName
                      ? `From “${plannedToday[0].planName}” — it will prefill your logger.`
                      : "Scheduled for today — it will prefill your logger."}
                  </div>
                </div>
              </div>
              <Button asChild size="sm" variant="default">
                <Link href="/log">
                  Start now <ArrowRight className="size-4" />
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
              <CardTitle className="text-base">Weekly volume</CardTitle>
              <CardDescription>
                Total weight lifted per week (last 10 weeks)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VolumeChart data={data.weeklyVolume} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Progressive overload</CardTitle>
              <CardDescription>
                Estimated 1RM and top set per session
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
            <CardTitle className="text-base">Recent workouts</CardTitle>
            <CardDescription>Your last sessions at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentWorkouts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing logged yet. Your first workout is one tap away.
                </p>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/log">Log your first workout</Link>
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
                            ` · +${exerciseNames.length - 4} more`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="outline">{formatVolume(w.volume)}</Badge>
                        <span className="tabular-nums">
                          {formatShortDate(w.date)}
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
