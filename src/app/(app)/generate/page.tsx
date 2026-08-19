import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { PlanGenerator } from "@/components/generate/plan-generator";
import { requireUserId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.generateTitle };
}

export default async function GeneratePage() {
  await requireUserId();
  const t = await getDictionary();
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.generatePage.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.generatePage.subtitle}
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <PlanGenerator aiEnabled={aiEnabled} />
      </FadeIn>
    </div>
  );
}
