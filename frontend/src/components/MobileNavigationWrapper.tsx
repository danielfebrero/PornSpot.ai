"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MobileNavigation } from "@/components/ui/MobileNavigation";
import { Compass, Zap, Image, Coins, Video } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";

export function MobileNavigationWrapper() {
  const pathname = usePathname();
  const { user } = useUserContext();
  const t = useTranslations("common");
  const tNav = useTranslations("navigation");

  // Don't show on admin pages
  const isAdminPage = pathname.includes("/admin");
  if (isAdminPage) {
    return null;
  }

  const navigationItems = user
    ? [
        {
          href: "/",
          label: t("discover"),
          icon: Compass,
          exactPath: true,
        },
        {
          href: "/user/pornspotcoin",
          label: tNav("pornspotcoin"),
          icon: Coins,
        },
        {
          href: "/generate",
          label: t("generate"),
          icon: Zap,
        },
        {
          href: "/user/videos",
          label: tNav("videos"),
          icon: Video,
        },
        {
          href: "/user/images",
          label: tNav("images"),
          icon: Image,
        },
      ]
    : [
        {
          href: "/",
          label: t("discover"),
          icon: Compass,
          exactPath: true,
        },
        {
          href: "/generate",
          label: t("generate"),
          icon: Zap,
        },
        {
          href: "/pornspotcoin",
          label: tNav("pornspotcoin"),
          icon: Coins,
        },
      ];

  return <MobileNavigation navigationItems={navigationItems} />;
}
