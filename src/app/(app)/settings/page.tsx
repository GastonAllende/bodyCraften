import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { ResetHistoryCard } from "@/components/settings/reset-history-card";
import { requireUserId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getHistorySize } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.settingsTitle };
}

export default async function SettingsPage() {
  const userId = await requireUserId();
  const t = await getDictionary();
  const history = await getHistorySize(userId);

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.settingsPage.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.settingsPage.subtitle}
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="max-w-xl">
          <ResetHistoryCard history={history} />
        </div>
      </FadeIn>
    </div>
  );
}
