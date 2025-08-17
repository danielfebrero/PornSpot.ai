import { notFound } from "next/navigation";
import { getMediaById } from "@/lib/data";
import { composeMediaUrl } from "@/lib/urlUtils";
import { getMediaDisplayUrl } from "@/lib/utils";
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

// Force dynamic - pages are rendered on each request
export const dynamic = "force-dynamic";

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

// NO generateStaticParams when using force-dynamic

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
