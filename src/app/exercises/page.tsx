import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { ExerciseBrowser } from "@/components/exercises/exercise-browser";
import { getExerciseCatalogMerged } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  const catalog = await getExerciseCatalogMerged();

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          Exercise library
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse exercises, save the ones you use, or add your own.
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
