import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { discoverApi } from "@/lib/api/discover";
import { Album, DiscoverCursors, Media } from "@/types";
import { DiscoverClient } from "@/components/DiscoverClient";
import { locales } from "@/i18n";
import { generateHomepageMetadata } from "@/lib/opengraph";
// import EvilPrefetch from "@/components/EvilPrefetch";

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable ISR for this page - static generation with revalidation
export const revalidate = 600; // Revalidate every 10 minutes (60 * 10)
export const dynamic = "force-static"; // Force static generation at build time
export const dynamicParams = true; // Allow dynamic params (for tags)

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { tag } = await searchParams;
  return generateHomepageMetadata(locale, tag);
}

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { locale } = await params;
  const { tag } = await searchParams;
  const t = await getTranslations({ locale, namespace: "site" });
  const tCommon = await getTranslations({
    locale,
    namespace: "common",
  });
  const tPlaceholders = await getTranslations({
    locale,
    namespace: "placeholders",
  });

  let items: (Album | Media)[] = [];
  let pagination: DiscoverCursors | null = null;
  let error: string | null = null;

  try {
    const result = await discoverApi.getDiscover({
      limit: 60,
      ...(tag && { tag }), // Include tag if provided
    });

    items = result.items || [];
    pagination = result.cursors || null;
  } catch (fetchError) {
    console.error("Exception while fetching albums:", fetchError);
    error = String(fetchError);
  }

  return (
    <>
      {/* SEO-friendly hidden content for search engines */}
      {/* <EvilPrefetch data="test" /> */}
      <div className="sr-only">
        <h1>{t("welcomeTitle")}</h1>
        <p>{t("welcomeDescription")}</p>
      </div>

      {error && items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">
            {tCommon("errors.loadingItems")}: {error}
          </p>
          <p className="text-gray-500">{tCommon("errors.refreshPage")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">{tPlaceholders("noItems")}</p>
        </div>
      ) : (
        <DiscoverClient
          initialContent={items}
          initialPagination={pagination}
          initialError={error}
          initialTag={tag}
        />
      )}
    </>
  );
}
