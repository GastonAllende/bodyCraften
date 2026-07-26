import {
  CalendarRange,
  Dumbbell,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type NavItem = {
  href: string;
  labelKey: keyof Dictionary["nav"];
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/log", labelKey: "log", icon: NotebookPen },
  { href: "/plans", labelKey: "plans", icon: CalendarRange },
  { href: "/exercises", labelKey: "exercises", icon: Dumbbell },
  { href: "/generate", labelKey: "generate", icon: Sparkles },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
