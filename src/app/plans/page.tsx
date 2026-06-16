import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { PlansView } from "@/components/plans/plans-view";
import {
  getLibraryExercises,
  getPlansWithDays,
  getUpcomingSchedule,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Plans & schedule" };

export default async function PlansPage() {
  const plans = getPlansWithDays();
  const schedule = getUpcomingSchedule();
  const exerciseNames = getLibraryExercises().map((e) => e.name);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          Plans &amp; schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          Build training plans and put them on your calendar.
        </p>
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
