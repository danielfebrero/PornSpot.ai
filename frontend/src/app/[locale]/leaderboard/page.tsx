import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { leaderboardApi } from "@/lib/api/leaderboard";
import { LeaderboardClient } from "@/components/LeaderboardClient";
import { locales } from "@/i18n";
import { UnifiedLeaderboardResponse } from "@/types";

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable ISR for this page - revalidate every 1 hour (3600 seconds)
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leaderboard" });

  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "leaderboard" });

  let initialData: UnifiedLeaderboardResponse = {
    users: [],
    pagination: {
      hasNext: false,
      cursor: null,
      limit: 50,
    },
  };
  let error: string | null = null;

  try {
    // Fetch initial leaderboard data with ISR caching
    initialData = await leaderboardApi.getPSCLeaderboard({
      limit: 50,
      // Ensure Next.js caches properly under ISR
      fetchOptions: { cache: "force-cache", next: { revalidate: 3600 } },
    });
  } catch (fetchError) {
    console.error("Exception while fetching leaderboard:", fetchError);
    error = String(fetchError);
  }

  // Error state - only if we have no data at all
  if (error && initialData.users.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t("error.title")}
          </h2>
          <p className="text-muted-foreground mt-2">{t("error.message")}</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state - if no users in leaderboard
  if (initialData.users.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t("empty.title")}
          </h3>
          <p className="text-muted-foreground">{t("empty.description")}</p>
        </div>
      </div>
    );
  }

  return <LeaderboardClient initialData={initialData} />;
}
