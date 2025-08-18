import React from "react";
import { ThumbnailUrls } from "../../types/index";
import { useContainerDimensions } from "../../hooks/useContainerDimensions";

interface ResponsivePictureProps {
  thumbnailUrls?: ThumbnailUrls;
  fallbackUrl: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  onClick?: () => void;
}

// Thumbnail configurations matching backend
const THUMBNAIL_CONFIGS = {
  cover: { width: 128, height: 128, quality: 80, suffix: "_thumb_cover" },
  small: { width: 240, height: 240, quality: 85, suffix: "_thumb_small" },
  medium: { width: 300, height: 300, quality: 90, suffix: "_thumb_medium" },
  large: { width: 365, height: 365, quality: 90, suffix: "_thumb_large" },
  xlarge: { width: 600, height: 600, quality: 95, suffix: "_thumb_xlarge" },
  originalSize: {
    width: Infinity,
    height: Infinity,
    quality: 95,
    suffix: "_display",
  },
} as const;

/**
 * Intelligently select the best thumbnail size based on container dimensions
 * Uses device pixel ratio and considers optimal quality vs bandwidth tradeoffs
 */
function selectOptimalThumbnailSize(
  containerWidth: number,
  containerHeight: number,
  thumbnailUrls?: ThumbnailUrls
): keyof ThumbnailUrls | null {
  if (!thumbnailUrls) return null;

  // Get device pixel ratio for high-DPI displays
  const devicePixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Calculate required pixel dimensions accounting for device pixel ratio
  const requiredWidth = containerWidth * devicePixelRatio;
  const requiredHeight = containerHeight * devicePixelRatio;

  // Use the larger dimension for square thumbnails (they're all square)
  const targetSize = Math.max(requiredWidth, requiredHeight);

  // Get available thumbnail sizes sorted by preference
  const availableSizes = Object.keys(thumbnailUrls) as (keyof ThumbnailUrls)[];

  // Create preference mapping - prefer sizes that are close to but larger than needed
  const sizePreferences = availableSizes
    .map((size) => {
      const config = THUMBNAIL_CONFIGS[size as keyof typeof THUMBNAIL_CONFIGS];
      if (!config) return null;

      const thumbnailSize = config.width;

      // Score based on how well the thumbnail size fits the container
      let score = 0;

      if (thumbnailSize >= targetSize) {
        // Prefer sizes that are larger than needed but not too much larger
        const excess = thumbnailSize - targetSize;
        const excessRatio = excess / targetSize;

        if (excessRatio <= 0.5) {
          // Within 50% - excellent match
          score = 1000 - excessRatio * 100;
        } else if (excessRatio <= 1.0) {
          // Within 100% - good match
          score = 800 - excessRatio * 100;
        } else {
          // More than 100% larger - penalize heavily but still usable
          score = 600 - Math.min(excessRatio * 50, 400);
        }
      } else {
        // Size is smaller than needed - penalize based on how much smaller
        const deficit = targetSize - thumbnailSize;
        const deficitRatio = deficit / targetSize;
        score = 500 - deficitRatio * 200;
      }

      // Quality bonus for higher resolution images
      score += config.quality;

      return { size, thumbnailSize, score };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  // Return the best match, or fall back to best available
  if (sizePreferences.length > 0) {
    return sizePreferences[0]!.size;
  }

  // Fallback order if no perfect matches
  const fallbackOrder: (keyof ThumbnailUrls)[] = [
    "originalSize",
    "xlarge",
    "large",
    "medium",
    "small",
    "cover",
  ];
  for (const size of fallbackOrder) {
    if (thumbnailUrls[size]) {
      return size;
    }
  }

  return null;
}

/**
 * Generate responsive picture sources based on container dimensions
 * Creates multiple sources for different viewport scenarios
 */
function generateIntelligentPictureSources(
  thumbnailUrls: ThumbnailUrls | undefined,
  containerWidth: number,
  containerHeight: number
): Array<{ media: string; srcSet: string }> {
  if (!thumbnailUrls || containerWidth === 0) return [];

  const sources: Array<{ media: string; srcSet: string }> = [];

  // Generate sources for different device scenarios
  const scenarios = [
    { media: "(max-width: 640px)", dpr: 2 }, // Mobile high-DPI
    { media: "(min-width: 641px) and (max-width: 1024px)", dpr: 2 }, // Tablet high-DPI
    { media: "(min-width: 1025px)", dpr: 1.5 }, // Desktop moderate-DPI
    {
      media: "(min-width: 1025px) and (-webkit-min-device-pixel-ratio: 2)",
      dpr: 2,
    }, // Desktop high-DPI
  ];

  for (const scenario of scenarios) {
    const targetSize = Math.max(containerWidth, containerHeight) * scenario.dpr;

    // Find best size for this scenario
    const availableSizes = Object.entries(THUMBNAIL_CONFIGS)
      .filter(([size]) => thumbnailUrls[size as keyof ThumbnailUrls])
      .map(([size, config]) => ({ size, width: config.width }))
      .sort((a, b) => {
        // Prefer sizes that are >= target but not too much larger
        const aFit =
          a.width >= targetSize
            ? a.width - targetSize
            : targetSize - a.width + 1000;
        const bFit =
          b.width >= targetSize
            ? b.width - targetSize
            : targetSize - b.width + 1000;
        return aFit - bFit;
      });

    if (availableSizes.length > 0) {
      const bestSize = availableSizes[0].size as keyof ThumbnailUrls;
      const url = thumbnailUrls[bestSize];
      if (url) {
        sources.push({
          media: scenario.media,
          srcSet: url,
        });
      }
    }
  }

  return sources;
}

/**
 * Get the optimal default image source based on container dimensions
 */
function getOptimalDefaultImageSrc(
  thumbnailUrls: ThumbnailUrls | undefined,
  fallbackUrl: string,
  containerWidth: number,
  containerHeight: number
): string {
  if (!thumbnailUrls) return fallbackUrl;

  const optimalSize = selectOptimalThumbnailSize(
    containerWidth,
    containerHeight,
    thumbnailUrls
  );

  if (optimalSize && thumbnailUrls[optimalSize]) {
    return thumbnailUrls[optimalSize];
  }

  // Fallback chain
  const fallbackOrder: (keyof ThumbnailUrls)[] = [
    "originalSize",
    "xlarge",
    "large",
    "medium",
    "small",
    "cover",
  ];
  for (const size of fallbackOrder) {
    if (thumbnailUrls[size]) {
      return thumbnailUrls[size];
    }
  }

  return fallbackUrl;
}

export const ResponsivePicture: React.FC<ResponsivePictureProps> = ({
  thumbnailUrls,
  fallbackUrl,
  alt,
  className,
  loading = "lazy",
  onClick,
}) => {
  const { containerRef, dimensions } = useContainerDimensions();

  console.log({ thumbnailUrls, dimensions });

  // Generate intelligent sources based on container dimensions
  const sources = generateIntelligentPictureSources(
    thumbnailUrls,
    dimensions.width,
    dimensions.height
  );

  // Get optimal default source
  const defaultSrc = getOptimalDefaultImageSrc(
    thumbnailUrls,
    fallbackUrl,
    dimensions.width,
    dimensions.height
  );

  console.log({ sources, defaultSrc });

  // If no responsive sources available, fall back to simple img
  if (sources.length === 0) {
    return (
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="w-full h-full"
      >
        <img
          src={defaultSrc}
          alt={alt}
          className={className}
          loading={loading}
          onClick={onClick}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="w-full h-full"
    >
      <picture onClick={onClick}>
        {sources.map(
          (source: { media: string; srcSet: string }, index: number) => (
            <source key={index} media={source.media} srcSet={source.srcSet} />
          )
        )}
        <img
          src={defaultSrc}
          alt={alt}
          className={className}
          loading={loading}
        />
      </picture>
    </div>
  );
};

export default ResponsivePicture;
