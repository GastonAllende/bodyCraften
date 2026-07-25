import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { ExerciseBrowser } from "@/components/exercises/exercise-browser";
import { getDictionary } from "@/lib/i18n/server";
import { getExerciseCatalogMerged } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.exercisesTitle };
}

export default async function ExercisesPage() {
  const t = await getDictionary();
  const catalog = await getExerciseCatalogMerged();

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.exercisesPage.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.exercisesPage.subtitle}
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <ExerciseBrowser
          exercises={catalog.exercises}
          source={catalog.source}
          apiError={catalog.error}
        />
      </FadeIn>
    </div>
  );
}
