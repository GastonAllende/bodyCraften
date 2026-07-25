"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { DICTIONARIES, type Dictionary } from "@/lib/i18n/dictionaries";

const I18nContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

/** Current locale and its dictionary, for client components. */
export function useI18n(): { locale: Locale; t: Dictionary } {
  const locale = useContext(I18nContext);
  return { locale, t: DICTIONARIES[locale] };
}
