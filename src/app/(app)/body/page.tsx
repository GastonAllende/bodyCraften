import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { BodyTrackerView } from "@/components/body/body-tracker-view";
import { requireUserId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getBodyHistory } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.bodyTitle };
}

export default async function BodyPage() {
  const userId = await requireUserId();
  const t = await getDictionary();
  const history = await getBodyHistory(userId);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.bodyPage.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.bodyPage.subtitle}</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <BodyTrackerView userId={userId} history={history} />
      </FadeIn>
    </div>
  );
}
