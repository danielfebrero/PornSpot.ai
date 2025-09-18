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

  // Base navigation items for all users (logged in or not)
  const baseNavigationItems = [
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
  ];

  if (!user) {
    baseNavigationItems.push({
      href: "/pornspotcoin",
      label: tNav("pornspotcoin"),
      icon: Coins,
    });
  }

  // Additional navigation items for logged-in users
  const userNavigationItems = user
    ? [
        {
          href: "/user/pornspotcoin",
          label: tNav("pornspotcoin"),
          icon: Coins,
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
    : [];

  const navigationItems = [...baseNavigationItems, ...userNavigationItems];

  return <MobileNavigation navigationItems={navigationItems} />;
}
