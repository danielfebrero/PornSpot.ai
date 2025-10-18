import { notFound } from "next/navigation";
import { getMediaById } from "@/lib/data";
import { composeMediaUrl } from "@/lib/urlUtils";
import { getMediaDisplayUrl } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { MediaDetailClient } from "@/components/MediaDetailClient";
import { generateMediaMetadata } from "@/lib/opengraph";
import { Lock } from "lucide-react";

interface MediaDetailPageProps {
  params: Promise<{
    locale: string;
    mediaId: string;
  }>;
}

// Force dynamic - pages are rendered on each request
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: MediaDetailPageProps): Promise<Metadata> {
  const { locale, mediaId } = await params;
  const { data: media, error } = await getMediaById(mediaId, {
    injectHeadersCookie: true,
  });

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
  const { mediaId, locale } = await params;
  const mediaResult = await getMediaById(mediaId, {
    injectHeadersCookie: true,
  });

  if (mediaResult.error) {
    if (mediaResult.error === "Content is private") {
      const tCommon = await getTranslations({
        locale,
        namespace: "common",
      });

      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-semibold">
              {tCommon("errors.contentPrivate")}
            </h1>
            <p className="text-muted-foreground">
              {tCommon("errors.contentPrivateDescription")}
            </p>
          </div>
        </div>
      );
    }

    notFound();
  }

  if (!mediaResult.data) {
    notFound();
  }

  const media = mediaResult.data;

  return <MediaDetailClient media={media} />;
}
