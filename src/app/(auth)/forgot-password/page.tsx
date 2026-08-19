import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const t = await getDictionary();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.auth.forgotTitle}</CardTitle>
        <CardDescription>{t.auth.forgotSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
