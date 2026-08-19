import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { PlansView } from "@/components/plans/plans-view";
import { requireUserId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import {
  getLibraryExercises,
  getPlansWithDays,
  getUpcomingSchedule,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.plansTitle };
}

export default async function PlansPage() {
  const userId = await requireUserId();
  const t = await getDictionary();
  const [plans, schedule, library] = await Promise.all([
    getPlansWithDays(userId),
    getUpcomingSchedule(userId),
    getLibraryExercises(userId),
  ]);
  const exerciseNames = library.map((e) => e.name);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.plansPage.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.plansPage.subtitle}</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <PlansView
          plans={plans}
          schedule={schedule}
          exerciseNames={exerciseNames}
        />
      </FadeIn>
    </div>
  );
}
