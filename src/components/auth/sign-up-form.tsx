"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { signUp } from "@/lib/auth-actions";

export function SignUpForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t.auth.passwordsDontMatch);
      return;
    }
    startTransition(async () => {
      const result = await signUp({ email, password });
      if (result.ok) {
        setSubmitted(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (submitted) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm">{t.auth.checkEmailToVerify}</p>
        <Link
          href="/sign-in"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {t.auth.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.auth.emailLabel}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t.auth.passwordLabel}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">{t.auth.confirmPasswordLabel}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.auth.signingUp : t.auth.signUpButton}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t.auth.haveAccount}{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t.auth.signInLink}
        </Link>
      </p>
    </form>
  );
}
