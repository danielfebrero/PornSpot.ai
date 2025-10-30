import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export interface OpenGraphConfig {
  locale: string;
  title?: string;
  description?: string;
  keywords?: string[];
  url?: string;
  image?: string;
  type?: "website" | "article" | "video.other";
  siteName?: string;
  additionalKeywords?: string[];
}

export interface TranslatedOpenGraphConfig
  extends Omit<OpenGraphConfig, "title" | "description"> {
  titleKey?: string;
  titleParams?: Record<string, string>;
  descriptionKey?: string;
  descriptionParams?: Record<string, string>;
  namespace?: string;
}

/**
 * Generate OpenGraph metadata using direct title and description
 */
export async function generateOpenGraphMetadata(
  config: OpenGraphConfig
): Promise<Metadata> {
  const {
    locale,
    title,
    description,
    keywords = [],
    url,
    image,
    type = "website",
    siteName,
    additionalKeywords = [],
  } = config;

  // Get site translations for fallbacks
  const t = await getTranslations({ locale, namespace: "site" });

  const finalTitle = title || t("meta.title");
  const finalDescription = description || t("meta.description");
  const finalSiteName = siteName || t("name");

  // Ensure image is an absolute URL
  const finalImage = ensureAbsoluteUrl(image);

  // Combine base keywords with additional ones
  const baseKeywords = [
    t("keywords.aiPorn"),
    t("keywords.aiGeneratedContent"),
    t("keywords.adultContent"),
    t("keywords.aiImages"),
    t("keywords.generatedPorn"),
  ];

  const allKeywords = [...baseKeywords, ...keywords, ...additionalKeywords];

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: allKeywords,
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      url: url,
      type: type,
      locale: locale,
      siteName: finalSiteName,
      images: [finalImage],
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
      images: [finalImage],
    },
  };
}

/**
 * Generate OpenGraph metadata using translation keys
 */
export async function generateTranslatedOpenGraphMetadata(
  config: TranslatedOpenGraphConfig
): Promise<Metadata> {
  const {
    locale,
    titleKey,
    titleParams = {},
    descriptionKey,
    descriptionParams = {},
    namespace = "site",
    ...otherConfig
  } = config;

  // Get translations
  const t = await getTranslations({ locale, namespace });
  const tSite = await getTranslations({ locale, namespace: "site" });

  // Merge siteName into titleParams if needed
  const finalTitleParams = {
    siteName: tSite("name"),
    ...titleParams,
  };

  const title = titleKey ? t(titleKey, finalTitleParams) : undefined;
  const description = descriptionKey
    ? t(descriptionKey, descriptionParams)
    : undefined;

  return generateOpenGraphMetadata({
    ...otherConfig,
    locale,
    title,
    description,
    siteName: tSite("name"),
  });
}

/**
 * Convert relative URLs to absolute URLs for social media compatibility
 */
export function ensureAbsoluteUrl(url?: string): string {
  if (!url) {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.pornspot.ai";
    return `${baseUrl}/website.png`;
  }

  if (url.startsWith("http")) {
    return url; // Already absolute
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pornspot.ai";
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Generate base site URL for a given locale and path
 */
export function generateSiteUrl(locale: string, path: string = ""): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.pornspot.ai";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${baseUrl}/${locale}${cleanPath ? `/${cleanPath}` : ""}`;
}

/**
 * Quick helper for homepage metadata
 */
export async function generateHomepageMetadata(
  locale: string,
  tag?: string
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "site" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const baseTitle = t("meta.title");
  const title = tag ? `${baseTitle} - ${tag}` : baseTitle;
  const baseDescription = t("meta.description");
  const description = tag
    ? `${baseDescription} ${tCommon("filteredBy")}: ${tag}`
    : baseDescription;

  return generateOpenGraphMetadata({
    locale,
    title,
    description,
    url: generateSiteUrl(locale),
    additionalKeywords: tag ? [tag] : [],
  });
}

/**
 * Quick helper for album metadata
 */
export async function generateAlbumMetadata(
  locale: string,
  albumId: string,
  album: {
    title: string;
    tags?: string[];
    coverImageUrl?: string;
  }
): Promise<Metadata> {
  const tAlbum = await getTranslations({ locale, namespace: "album" });
  const tSite = await getTranslations({ locale, namespace: "site" });

  const albumDescription =
    album.tags?.join(", ") ||
    tAlbum("defaultDescription", { title: album.title });

  const siteName = tSite("name");
  const metaTitle = tAlbum("metaTitle", { title: album.title, siteName });
  const metaDescription = tAlbum("metaDescription", {
    description: albumDescription,
    siteName,
  });

  const albumKeywords = [
    tAlbum("keywords.aiAlbum"),
    tAlbum("keywords.generatedContent"),
    tAlbum("keywords.images"),
    tAlbum("keywords.videos"),
    ...(album.tags || []),
  ];

  return generateOpenGraphMetadata({
    locale,
    title: metaTitle,
    description: metaDescription,
    keywords: albumKeywords,
    url: generateSiteUrl(locale, `albums/${albumId}`),
    image: ensureAbsoluteUrl(album.coverImageUrl),
    type: "article",
  });
}

/**
 * Quick helper for media metadata
 */
export async function generateMediaMetadata(
  locale: string,
  mediaId: string,
  media: {
    type?: "image" | "video";
    originalFilename?: string;
    filename: string;
    metadata?: {
      prompt?: string;
      tags?: string[];
    };
  },
  displayImageUrl?: string
): Promise<Metadata> {
  const tSite = await getTranslations({ locale, namespace: "site" });
  const tMedia = await getTranslations({ locale, namespace: "media" });

  const siteName = tSite("name");
  const mediaTitle = media.originalFilename || media.filename;
  const isVideo = media.type === "video";

  const typeLabel = isVideo ? tMedia("types.video") : tMedia("types.image");
  const promptDescription = media.metadata?.prompt?.trim();
  const fallbackDescription = isVideo
    ? tMedia("meta.watchVideo", { siteName })
    : tMedia("meta.viewImage", { siteName });

  const metaDescription = promptDescription
    ? `${promptDescription}. ${
        isVideo
          ? tMedia("meta.aiGeneratedVideo", { siteName })
          : tMedia("meta.aiGeneratedImage", { siteName })
      }`
    : `${fallbackDescription}. ${
        isVideo
          ? tMedia("meta.aiGeneratedVideo", { siteName })
          : tMedia("meta.aiGeneratedImage", { siteName })
      }`;

  const baseKeywords = isVideo
    ? [
        tMedia("keywords.aiGeneratedVideo"),
        tMedia("keywords.adultVideo"),
        tMedia("keywords.pornVideo"),
        tMedia("keywords.aiNSFWVideo"),
      ]
    : [
        tMedia("keywords.aiGeneratedImage"),
        tMedia("keywords.adultImage"),
        tMedia("keywords.pornImage"),
        tMedia("keywords.aiArt"),
      ];

  const keywords = Array.from(
    new Set([...baseKeywords, typeLabel, ...(media.metadata?.tags || [])])
  ).filter(Boolean);

  return generateOpenGraphMetadata({
    locale,
    title: `${mediaTitle} (${typeLabel}) - ${siteName}`,
    description: metaDescription,
    keywords,
    url: generateSiteUrl(locale, `media/${mediaId}`),
    image: ensureAbsoluteUrl(displayImageUrl),
    type: isVideo ? "video.other" : "article",
  });
}
