import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { I18nProvider } from "@/components/i18n-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getDictionary, getLocale } from "@/lib/i18n/server";

const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: {
      default: t.metadata.title,
      template: "%s · BodyCraften",
    },
    description: t.metadata.description,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#061824" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${interSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="antialiased">
        <I18nProvider locale={locale}>
          <Providers>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="top-center" />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
