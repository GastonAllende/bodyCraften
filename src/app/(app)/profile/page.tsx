import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { ProfileDetailsForm } from "@/components/profile/profile-details-form";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.metadata.profileTitle };
}

export default async function ProfilePage() {
  // Not `requireUserId()` — this page needs the email from the same verified
  // claims, and re-reading them separately would cost a second round-trip.
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const t = await getDictionary();
  const profile = await getProfile(user.id, user.email);

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.profilePage.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.profilePage.subtitle}
        </p>
      </FadeIn>

      <div className="flex max-w-xl flex-col gap-6">
        <FadeIn delay={0.05}>
          <ProfileIdentityCard
            email={profile.email}
            firstName={profile.firstName}
            lastName={profile.lastName}
            displayName={profile.displayName}
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <ProfileDetailsForm
            profile={{
              firstName: profile.firstName,
              lastName: profile.lastName,
              displayName: profile.displayName,
              birthDate: profile.birthDate,
              gender: profile.gender,
            }}
          />
        </FadeIn>
      </div>
    </div>
  );
}
