import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getViewportWidth } from "./deviceUtils";
import {
  ThumbnailSize,
  ThumbnailContext,
  ThumbnailUrls,
  Media,
} from "../types/index";

// Re-export types for convenience
export type { ThumbnailSize, ThumbnailContext };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the optimal display URL for a media item
 * Prefers WebP optimized version for images, falls back to original URL
 */
export function getMediaDisplayUrl(media: Media): string {
  // Ensure we have valid media object and mimeType before checking
  if (!media || typeof media !== "object") {
    return "";
  }

  const isImageMedia = isImage(media);

  // For images, prefer WebP display version (stored as originalSize thumbnail) for better performance
  if (isImageMedia && media.thumbnailUrls?.originalSize) {
    return media.thumbnailUrls.originalSize;
  }

  // Fall back to original URL
  return media.url || "";
}

/**
 * Check if a media item is a video based on its MIME type
 */
export function isVideo(media: Media): boolean {
  return (
    media?.mimeType?.startsWith("video/") || media?.type === "video" || false
  );
}

/**
 * Check if a media item is an image based on its MIME type
 */
export function isImage(media: Media): boolean {
  return media?.mimeType?.startsWith("image/") || false;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const day = d.getUTCDate();
  const monthIndex = d.getUTCMonth();
  const year = d.getUTCFullYear();

  return `${MONTH_NAMES[monthIndex]} ${day}, ${year}`;
}

export function formatDateShort(date: string | Date): string {
  const d = new Date(date);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function debounce<T extends (..._args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (..._args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Responsive breakpoints (matching Tailwind defaults)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/**
 * Get current screen size category based on window width
 */
export function getScreenSize(): "sm" | "md" | "lg" | "xl" | "2xl" {
  if (typeof window === "undefined") return "lg"; // SSR fallback

  const width = getViewportWidth();

  if (width < BREAKPOINTS.sm) return "sm";
  if (width < BREAKPOINTS.md) return "md";
  if (width < BREAKPOINTS.lg) return "lg";
  if (width < BREAKPOINTS.xl) return "xl";
  return "2xl";
}

/**
 * Select optimal thumbnail size based on context and screen size
 */
export function selectThumbnailSize(
  context: ThumbnailContext,
  screenSize?: "sm" | "md" | "lg" | "xl" | "2xl",
  columns?: number
): ThumbnailSize {
  const size = screenSize || getScreenSize();

  // Cover selector always uses cover size
  if (context === "cover-selector") {
    return "cover";
  }

  // Discover logic
  if (context === "discover") {
    switch (size) {
      case "sm":
      case "md":
        return "xlarge"; // 600px for small/medium screens
      case "lg":
        return "large"; // 365px for large screens
      case "xl":
      case "2xl":
      default:
        return "medium"; // 300px for very large screens
    }
  }

  // Albums logic
  if (context === "albums") {
    switch (size) {
      case "sm":
      case "md":
        return "xlarge"; // 600px for small/medium screens
      case "lg":
        return "medium"; // 300px for large screens
      case "xl":
        return columns && columns >= 6 ? "small" : "medium"; // 240px or 300px based on columns
      case "2xl":
      default:
        return "large"; // 365px for very large screens
    }
  }

  // Admin context - use medium as default for good balance
  if (context === "admin") {
    switch (size) {
      case "sm":
        return "large"; // 365px for small admin screens
      case "md":
        return "medium"; // 300px for medium admin screens
      case "lg":
      case "xl":
      case "2xl":
      default:
        return "small"; // 240px for large admin screens (more content fits)
    }
  }

  // Default fallback - responsive based on screen size
  switch (size) {
    case "sm":
      return "large";
    case "md":
      return "medium";
    case "lg":
    case "xl":
    case "2xl":
    default:
      return "small";
  }
}

/**
 * Get thumbnail URL with intelligent size selection and fallback chain
 *
 * @deprecated Use ResponsivePicture component instead for better mobile optimization.
 * The ResponsivePicture component provides mobile-first responsive images with
 * HTML picture elements, eliminating SSR/hydration issues.
 *
 * @example
 * // Old way (deprecated)
 * <img src={getThumbnailUrl(media, context)} alt="..." />
 *
 * // New way (recommended)
 * <ResponsivePicture
 *   thumbnailUrls={media.thumbnailUrls}
 *   fallbackUrl={media.url}
 *   alt="..."
 * />
 */
export function getThumbnailUrl(
  media: {
    thumbnailUrls?: ThumbnailUrls;
    thumbnailUrl?: string;
    url: string;
  },
  context: ThumbnailContext = "default",
  screenSize?: "sm" | "md" | "lg" | "xl" | "2xl",
  columns?: number
): string {
  // Log deprecation warning in development
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "getThumbnailUrl() is deprecated. Use ResponsivePicture component instead for better mobile optimization and SSR compatibility."
    );
  }
  const selectedSize = selectThumbnailSize(context, screenSize, columns);

  // Try to get the selected size first
  if (media.thumbnailUrls?.[selectedSize]) {
    return media.thumbnailUrls[selectedSize];
  }

  // Fallback chain: try other sizes in order of preference
  const fallbackOrder: ThumbnailSize[] = [
    "medium",
    "small",
    "large",
    "xlarge",
    "cover",
  ];

  for (const size of fallbackOrder) {
    if (media.thumbnailUrls?.[size]) {
      return media.thumbnailUrls[size];
    }
  }

  // Final fallbacks
  return media.thumbnailUrl || media.url;
}

/**
 * Get the appropriate thumbnail size name for a given context
 * Useful for debugging or displaying size information
 */
export function getThumbnailSizeName(
  context: ThumbnailContext,
  screenSize?: "sm" | "md" | "lg" | "xl" | "2xl",
  columns?: number
): string {
  const size = selectThumbnailSize(context, screenSize, columns);

  const sizeNames = {
    cover: "Cover (128px)",
    small: "Small (240px)",
    medium: "Medium (300px)",
    large: "Large (365px)",
    xlarge: "X-Large (600px)",
    originalSize: "Original Size (WebP optimized)",
  };

  return sizeNames[size];
}

/**
 * Format large numbers with K notation for numbers > 1000
 * Example: 22823 -> "22.8K", 950 -> "950"
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === null || value === undefined || value === 0) {
    return "0";
  }

  if (value > 1000) {
    const formatted = (value / 1000).toFixed(1);
    return `${formatted}K`;
  }

  // Round to 2 decimal places and remove trailing zeros
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
}
