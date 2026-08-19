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
import { requireUserId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import {
  getLastSessionHints,
  getLibraryExercises,
  getTodaysPrefills,
  getWorkoutHistory,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.logTitle };
}

export default async function LogPage() {
  const userId = await requireUserId();
  const t = await getDictionary();
  const [library, hints, prefills, history] = await Promise.all([
    getLibraryExercises(userId),
    getLastSessionHints(userId),
    getTodaysPrefills(userId),
    getWorkoutHistory(userId, 20),
  ]);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.logPage.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.logPage.subtitle}</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <WorkoutLogger library={library} hints={hints} prefills={prefills} />
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.logPage.history}</CardTitle>
            <CardDescription>{t.logPage.historyDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <HistoryList workouts={history} />
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
