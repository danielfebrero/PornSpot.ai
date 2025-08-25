"use client";

import { useAdminContext } from "@/contexts/AdminContext";
import { useAdminStatsQuery } from "@/hooks/queries/useAdminStatsQuery";
import { Card } from "@/components/ui/Card";
import { useTranslations } from "next-intl";

export default function AdminDashboard() {
  const { user } = useAdminContext();
  const { data: stats, isLoading: loading, error } = useAdminStatsQuery();
  const t = useTranslations("admin.dashboard");
  const tCommon = useTranslations("common");

  const getStatValue = (key: string, fallback: string = "—") => {
    if (loading) return tCommon("loading");
    if (error) return tCommon("error");
    if (!stats) return fallback;

    const value = stats[key as keyof typeof stats];
    if (typeof value === "number") {
      return value.toString();
    }
    if (typeof value === "string") {
      return value;
    }
    return fallback;
  };

  const getStatDescription = (loading: boolean, error: Error | null) => {
    if (loading) return tCommon("loading");
    if (error) return t("failedToLoad");
    return t("updatedJustNow");
  };

  const statsConfig = [
    {
      title: t("totalAlbums"),
      value: getStatValue("totalAlbums"),
      description: getStatDescription(loading, error),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      title: t("totalMedia"),
      value: getStatValue("totalMedia"),
      description: getStatDescription(loading, error),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      title: t("publicAlbums"),
      value: getStatValue("publicAlbums"),
      description: getStatDescription(loading, error),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      ),
    },
    {
      title: t("storageUsed"),
      value: getStatValue("storageUsed"),
      description: getStatDescription(loading, error),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="px-4 sm:px-0 py-4 sm:py-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t("welcomeBack", { username: user?.username || "" })}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("manageGalleryContent")}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-4 sm:px-0">
        {statsConfig.map((stat, index) => (
          <Card
            key={index}
            className="p-4 sm:p-6 hover:shadow-lg transition-shadow duration-200 cursor-default"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {stat.title}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 break-all">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </div>
              <div className="text-muted-foreground ml-3 flex-shrink-0 opacity-60">
                {stat.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
