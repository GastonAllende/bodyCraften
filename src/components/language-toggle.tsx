"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";
import { setLocale } from "@/lib/actions";
import type { Locale } from "@/lib/i18n/config";

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function LanguageToggle() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [, startSwitching] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    startSwitching(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.header.changeLanguage}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(LANGUAGE_NAMES) as Locale[]).map((code) => (
          <DropdownMenuItem key={code} onClick={() => switchTo(code)}>
            {LANGUAGE_NAMES[code]}
            {code === locale && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
