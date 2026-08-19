import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.auth.resetTitle };
}

export default async function ResetPasswordPage() {
  const t = await getDictionary();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.auth.resetTitle}</CardTitle>
        <CardDescription>{t.auth.resetSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
