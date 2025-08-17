import { notFound } from "next/navigation";
import { getMediaById, fetchAllPublicMedia } from "@/lib/data";
import { composeMediaUrl } from "@/lib/urlUtils";
import { getMediaDisplayUrl } from "@/lib/utils";
import { locales } from "@/i18n";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
// import { MediaDetailClient } from "@/components/MediaDetailClient";
import { generateMediaMetadata } from "@/lib/opengraph";

interface MediaDetailPageProps {
  params: {
    locale: string;
    mediaId: string;
  };
}

// SSG for existing albums at build time, ISR for new albums, revalidate on demand
export const revalidate = false;
export const dynamic = "auto";
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: MediaDetailPageProps): Promise<Metadata> {
  const { locale, mediaId } = params;
  const { data: media, error } = await getMediaById(mediaId);

  // Get localized translations for fallback
  const tMedia = await getTranslations({ locale, namespace: "media" });

  if (error || !media) {
    return {
      title: tMedia("errors.notFound"),
    };
  }

  // Ensure we have a valid media object with required fields
  const safeMedia = {
    ...media,
    mimeType: media.mimeType || "",
    url: media.url || "",
    thumbnailUrls: media.thumbnailUrls || {},
  };

  const displayImageUrl = composeMediaUrl(getMediaDisplayUrl(safeMedia));

  return generateMediaMetadata(locale, mediaId, media, displayImageUrl);
}

export async function generateStaticParams() {
  const media = await fetchAllPublicMedia();

  // const media = [{ id: "cbd5d4f9-51f2-4fa7-a0e3-58f44ad4f333" }];

  // // Generate all combinations of locale and mediaId
  const params = [];
  for (const locale of locales) {
    for (const item of media) {
      params.push({
        locale,
        mediaId: item.id,
      });
    }
  }

  // const params = [
  //   { locale: "en", mediaId: "cbd5d4f9-51f2-4fa7-a0e3-58f44ad4f333" },
  //   { locale: "fr", mediaId: "cbd5d4f9-51f2-4fa7-a0e3-58f44ad4f333" },
  //   { locale: "es", mediaId: "cbd5d4f9-51f2-4fa7-a0e3-58f44ad4f333" },
  // ];
  return params;
}

export default async function MediaDetailPage({
  params,
}: MediaDetailPageProps) {
  const { mediaId } = params;
  const mediaResult = await getMediaById(mediaId);

  if (mediaResult.error || !mediaResult.data) {
    notFound();
  }

  const media = mediaResult.data;

  // return <MediaDetailClient media={media} />;
  return <div>{JSON.stringify(media)}</div>;
}
