"use client";

import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { NAV_ITEMS, isActive } from "@/components/nav-items";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function AppBreadcrumb() {
  const pathname = usePathname();
  const { t } = useI18n();
  const current =
    NAV_ITEMS.find((item) => isActive(pathname, item.href)) ?? NAV_ITEMS[0];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          BodyCraften
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{t.nav[current.labelKey]}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
