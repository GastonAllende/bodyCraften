import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { I18nProvider } from "@/components/i18n-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
            <TooltipProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <AppBreadcrumb />
                    <div className="ml-auto flex items-center gap-1">
                      <LanguageToggle />
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 p-4 md:p-6">{children}</main>
                </SidebarInset>
              </SidebarProvider>
            </TooltipProvider>
            <Toaster richColors position="top-center" />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
