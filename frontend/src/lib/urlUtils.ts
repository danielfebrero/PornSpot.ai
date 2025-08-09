/**
 * URL composition utilities for handling media URLs
 *
 * This utility handles the composition of full URLs from relative paths
 * stored in the database, using environment-specific CDN domains.
 */

/**
 * Compose a full media URL from a relative path
 *
 * @param relativePath - The relative path (e.g., "/albums/123/media/file.jpg")
 * @returns Full URL with CDN domain
 */
export function composeMediaUrl(
  relativePath: string | null | undefined
): string {
  if (!relativePath) return "";

  // If it's already a full URL (backward compatibility), return as is
  if (
    typeof relativePath === "string" &&
    (relativePath.startsWith("http") || relativePath.startsWith("blob"))
  ) {
    return relativePath;
  }

  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) {
    console.warn("NEXT_PUBLIC_CDN_URL environment variable is not set");
    return relativePath || "";
  }

  // Ensure proper URL composition
  const cleanCdnUrl = cdnUrl.endsWith("/") ? cdnUrl.slice(0, -1) : cdnUrl;
  let cleanPath = relativePath.startsWith("/")
    ? relativePath
    : `/${relativePath}`;

  // For local development, prepend the bucket name
  if (process.env.NODE_ENV === "development") {
    const bucketName =
      process.env.NEXT_PUBLIC_S3_BUCKET || "local-pornspot-media";
    cleanPath = `/${bucketName}${cleanPath}`;
  }

  return `${cleanCdnUrl}${cleanPath}`;
}

/**
 * Compose URLs for a thumbnail object
 *
 * @param thumbnailUrls - Object containing thumbnail URLs at different sizes
 * @returns Object with composed full URLs
 */
export function composeThumbnailUrls(
  thumbnailUrls: { [size: string]: string | undefined } | null | undefined
): { [size: string]: string } | undefined {
  if (!thumbnailUrls || typeof thumbnailUrls !== "object") {
    return undefined;
  }

  const composedUrls: { [size: string]: string } = {};

  for (const [size, url] of Object.entries(thumbnailUrls)) {
    if (typeof url === "string") {
      composedUrls[size] = composeMediaUrl(url);
    }
  }

  return Object.keys(composedUrls).length > 0 ? composedUrls : undefined;
}

/**
 * Get the best thumbnail URL for a given context
 *
 * @param thumbnailUrls - Object containing thumbnail URLs
 * @param fallbackUrl - Fallback URL if no thumbnails available
 * @param preferredSize - Preferred thumbnail size
 * @returns Composed URL
 */
export function getBestThumbnailUrl(
  thumbnailUrls: { [size: string]: string | undefined } | null | undefined,
  fallbackUrl: string | null | undefined,
  preferredSize?: string
): string {
  const composedThumbnails = composeThumbnailUrls(thumbnailUrls);

  if (composedThumbnails) {
    // Try preferred size first
    if (preferredSize && composedThumbnails[preferredSize]) {
      return composedThumbnails[preferredSize];
    }

    // Fallback order: small -> medium -> large -> any available
    const fallbackOrder = ["small", "medium", "large"];
    for (const size of fallbackOrder) {
      if (composedThumbnails[size]) {
        return composedThumbnails[size];
      }
    }

    // Return first available thumbnail
    const availableSizes = Object.keys(composedThumbnails);
    if (availableSizes.length > 0) {
      return composedThumbnails[availableSizes[0]];
    }
  }

  // Use fallback URL if no thumbnails available
  return composeMediaUrl(fallbackUrl);
}

/**
 * Compose album cover URL
 *
 * @param coverImageUrl - The cover image relative path or URL
 * @returns Composed full URL
 */
export function composeAlbumCoverUrl(
  coverImageUrl: string | null | undefined
): string {
  return composeMediaUrl(coverImageUrl);
}

/**
 * Extract relative path from a full URL (for migration purposes)
 *
 * @param fullUrl - Full URL to extract path from
 * @returns Relative path or null if extraction fails
 */
export function extractRelativePath(fullUrl: string): string | null {
  if (!fullUrl || typeof fullUrl !== "string") return null;

  try {
    const url = new URL(fullUrl);
    return url.pathname;
  } catch {
    // If URL parsing fails, check if it's already a relative path
    return fullUrl.startsWith("/") ? fullUrl : null;
  }
}

/**
 * Validate if a URL is properly formatted
 *
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Get CDN domain from environment
 */
export function getCdnDomain(): string | null {
  return process.env.NEXT_PUBLIC_CDN_URL || null;
}
