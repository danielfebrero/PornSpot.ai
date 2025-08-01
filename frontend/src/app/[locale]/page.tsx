import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlbums } from "@/lib/data";
import { Album } from "@/types";
import { DiscoverClient } from "@/components/DiscoverClient";
import { locales } from "@/i18n";
import { generateHomepageMetadata } from "@/lib/opengraph";
import EvilPrefetch from "@/components/EvilPrefetch";

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable ISR for this page - static generation with revalidation
export const revalidate = 3600; // Revalidate every hour
export const dynamic = "force-static"; // Force static generation at build time
export const dynamicParams = true; // Allow dynamic params (for tags)

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { tag?: string };
}): Promise<Metadata> {
  return generateHomepageMetadata(params.locale, searchParams.tag);
}

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { tag?: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: "site" });
  const tCommon = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });
  const tPlaceholders = await getTranslations({
    locale: params.locale,
    namespace: "placeholders",
  });

  const tag = searchParams.tag;
  let albums: Album[] = [];
  let pagination: any = null;
  let error: string | null = null;

  try {
    const result = await getAlbums({
      isPublic: true,
      limit: 12,
      ...(tag && { tag }), // Include tag if provided
    });

    if (result.error) {
      console.error("Error fetching albums:", result.error);
      error = result.error;
    } else {
      albums = result.data?.albums || [];
      pagination = result.data?.pagination || null;
    }
  } catch (fetchError) {
    console.error("Exception while fetching albums:", fetchError);
    error = String(fetchError);
  }

  return (
    <>
      {/* SEO-friendly hidden content for search engines */}
      <EvilPrefetch data="test" />
      <div className="sr-only">
        <h1>{t("welcomeTitle")}</h1>
        <p>{t("welcomeDescription")}</p>
      </div>

      {error && albums.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">
            {tCommon("errors.loadingAlbums")}: {error}
          </p>
          <p className="text-gray-500">{tCommon("errors.refreshPage")}</p>
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">{tPlaceholders("noAlbums")}</p>
        </div>
      ) : (
        <DiscoverClient
          initialAlbums={albums}
          initialPagination={pagination}
          initialError={error}
          initialTag={tag}
        />
      )}
    </>
  );
}
