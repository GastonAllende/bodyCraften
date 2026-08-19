import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.auth.signInTitle };
}

export default async function SignInPage() {
  const t = await getDictionary();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.auth.signInTitle}</CardTitle>
        <CardDescription>{t.auth.signInSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
  );
}
