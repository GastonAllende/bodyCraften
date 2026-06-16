import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/motion";
import { WorkoutLogger } from "@/components/logger/workout-logger";
import { HistoryList } from "@/components/logger/history-list";
import {
  getLastSessionHints,
  getLibraryExercises,
  getTodaysPrefills,
  getWorkoutHistory,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Log workout" };

export default async function LogPage() {
  const library = getLibraryExercises();
  const hints = getLastSessionHints();
  const prefills = getTodaysPrefills();
  const history = getWorkoutHistory(20);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Log workout</h1>
        <p className="text-sm text-muted-foreground">
          Beat last session&apos;s numbers — that&apos;s progressive overload.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <WorkoutLogger library={library} hints={hints} prefills={prefills} />
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">History</CardTitle>
            <CardDescription>Tap a session to see every set</CardDescription>
          </CardHeader>
          <CardContent>
            <HistoryList workouts={history} />
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
