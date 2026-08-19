import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.auth.signUpTitle };
}

export default async function SignUpPage() {
  const t = await getDictionary();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.auth.signUpTitle}</CardTitle>
        <CardDescription>{t.auth.signUpSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
