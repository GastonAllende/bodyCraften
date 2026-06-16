import {
  CalendarRange,
  Dumbbell,
  LayoutDashboard,
  NotebookPen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "Log", icon: NotebookPen },
  { href: "/plans", label: "Plans", icon: CalendarRange },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/generate", label: "Generate", icon: Sparkles },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
