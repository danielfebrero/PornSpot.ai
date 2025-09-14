"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MobileNavigation } from "@/components/ui/MobileNavigation";
import {
  Compass,
  Zap,
  Heart,
  Bookmark,
  Image,
  FolderOpen,
  Coins,
} from "lucide-react";
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

  // Additional navigation items for logged-in users
  const userNavigationItems = user
    ? [
        {
          href: "/user/pornspotcoin",
          label: tNav("pornspotcoin"),
          icon: Coins,
        },
        {
          href: "/user/likes",
          label: tNav("likes"),
          icon: Heart,
        },
        {
          href: "/user/bookmarks",
          label: tNav("bookmarks"),
          icon: Bookmark,
        },
        {
          href: "/user/medias",
          label: tNav("medias"),
          icon: Image,
        },
        {
          href: "/user/albums",
          label: tNav("albums"),
          icon: FolderOpen,
        },
      ]
    : [];

  const navigationItems = [...baseNavigationItems, ...userNavigationItems];

  return <MobileNavigation navigationItems={navigationItems} />;
}
