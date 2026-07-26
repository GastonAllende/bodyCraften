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
  const t = await getDictionary();
  const library = getLibraryExercises();
  const hints = getLastSessionHints();
  const prefills = getTodaysPrefills();
  const history = getWorkoutHistory(20);

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
