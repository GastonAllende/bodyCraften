import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { PlanGenerator } from "@/components/generate/plan-generator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Generate a plan" };

export default function GeneratePage() {
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          Generate a plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Describe your goals in plain words — get a structured weekly plan you
          can save and schedule.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <PlanGenerator aiEnabled={aiEnabled} />
      </FadeIn>
    </div>
  );
}
