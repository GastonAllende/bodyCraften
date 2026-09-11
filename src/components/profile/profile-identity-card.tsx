"use client";

import { Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

/**
 * Read-only identity card: the avatar monogram, the name we address the user
 * by, and the account email. Email is not editable here — Supabase owns it and
 * changing it needs a verification round-trip, so showing an input that can't
 * actually save would be a lie.
 */
export function ProfileIdentityCard({
  email,
  firstName,
  lastName,
  displayName,
}: {
  email: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
}) {
  const { t } = useI18n();

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const shown = displayName || fullName;
  // Fall back to the email's local part so the card is never nameless on a
  // brand-new account that hasn't filled anything in yet.
  const heading = shown || email?.split("@")[0] || "";

  const initials =
    [firstName, lastName]
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || heading.slice(0, 2).toUpperCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.profilePage.accountSection}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-base font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-col gap-1">
            {heading ? (
              <p className="truncate text-base font-medium">{heading}</p>
            ) : null}
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4 shrink-0" aria-hidden />
              {email ? (
                <span className="truncate">{email}</span>
              ) : (
                <span className="truncate italic">
                  {t.profilePage.emailMissing}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t bg-muted/30">
        <p className="text-sm text-muted-foreground">
          {t.profilePage.emailHelp}
        </p>
      </CardFooter>
    </Card>
  );
}
