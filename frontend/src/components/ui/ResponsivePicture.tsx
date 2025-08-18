import React, { useMemo, useCallback } from "react";
import { ThumbnailUrls } from "@/types";
import { useContainerDimensions } from "@/hooks/useContainerDimensions";

interface ResponsivePictureProps {
  thumbnailUrls?: ThumbnailUrls;
  fallbackUrl: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  onClick?: () => void;
  priority?: "quality" | "performance" | "balanced";
  aspectRatio?: number; // width/height ratio
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

type ThumbnailSize = keyof typeof THUMBNAIL_CONFIGS;

// Performance optimization thresholds
const OPTIMIZATION_THRESHOLDS = {
  quality: { sizeMultiplier: 2.0, qualityWeight: 2.0 },
  performance: { sizeMultiplier: 1.2, qualityWeight: 0.5 },
  balanced: { sizeMultiplier: 1.5, qualityWeight: 1.0 },
} as const;

/**
 * Calculate the effective display size considering various factors
 */
function calculateEffectiveDisplaySize(
  containerWidth: number,
  containerHeight: number,
  aspectRatio?: number
): { width: number; height: number } {
  // Handle aspect ratio if provided
  if (aspectRatio && containerWidth > 0) {
    const calculatedHeight = containerWidth / aspectRatio;
    return {
      width: containerWidth,
      height:
        containerHeight > 0
          ? Math.min(containerHeight, calculatedHeight)
          : calculatedHeight,
    };
  }

  return { width: containerWidth, height: containerHeight };
}

/**
 * Enhanced thumbnail selection with improved scoring algorithm
 */
function selectOptimalThumbnail(
  containerWidth: number,
  containerHeight: number,
  thumbnailUrls?: ThumbnailUrls,
  priority: "quality" | "performance" | "balanced" = "balanced",
  aspectRatio?: number
): ThumbnailSize | null {
  if (!thumbnailUrls || (containerWidth === 0 && containerHeight === 0))
    return null;

  const devicePixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const networkSpeed = getNetworkSpeed();
  const thresholds = OPTIMIZATION_THRESHOLDS[priority];

  // Calculate effective display dimensions
  const effectiveSize = calculateEffectiveDisplaySize(
    containerWidth,
    containerHeight,
    aspectRatio
  );

  // Calculate required pixel dimensions
  const requiredWidth = effectiveSize.width * devicePixelRatio;
  const requiredHeight = effectiveSize.height * devicePixelRatio;
  const targetSize = Math.max(requiredWidth, requiredHeight);

  // Adjust target based on network conditions and priority
  const adjustedTarget = targetSize * (networkSpeed === "slow" ? 0.8 : 1.0);

  const availableSizes = (Object.keys(thumbnailUrls) as ThumbnailSize[]).filter(
    (size) => thumbnailUrls[size]
  );

  if (availableSizes.length === 0) return null;

  // Score each available size
  const scoredSizes = availableSizes.map((size) => {
    const config = THUMBNAIL_CONFIGS[size];
    const thumbnailSize =
      config.width === Infinity ? targetSize * 3 : config.width;

    let score = 0;

    // Size fit score
    const sizeDiff = thumbnailSize - adjustedTarget;
    const sizeDiffRatio = Math.abs(sizeDiff) / adjustedTarget;

    if (sizeDiff >= 0) {
      // Thumbnail is larger than needed
      if (sizeDiffRatio <= 0.2) {
        score += 1000; // Perfect fit (within 20%)
      } else if (sizeDiffRatio <= 0.5) {
        score += 800 - sizeDiffRatio * 200; // Good fit
      } else if (sizeDiffRatio <= thresholds.sizeMultiplier) {
        score += 600 - sizeDiffRatio * 100; // Acceptable
      } else {
        score += Math.max(0, 400 - sizeDiffRatio * 50); // Too large
      }
    } else {
      // Thumbnail is smaller than needed (upscaling required)
      if (sizeDiffRatio <= 0.1) {
        score += 900; // Minor upscaling acceptable
      } else if (sizeDiffRatio <= 0.25) {
        score += 700 - sizeDiffRatio * 400; // Some upscaling
      } else {
        score += Math.max(0, 500 - sizeDiffRatio * 500); // Significant upscaling
      }
    }

    // Quality score with priority weighting
    score += config.quality * thresholds.qualityWeight;

    // Network optimization bonus
    if (networkSpeed === "slow" && thumbnailSize <= adjustedTarget * 1.2) {
      score += 100; // Bonus for smaller sizes on slow connections
    }

    // Device pixel ratio consideration
    if (devicePixelRatio > 1 && thumbnailSize >= targetSize) {
      score += 50; // Bonus for high-DPI appropriate sizes
    }

    return { size, score, thumbnailSize };
  });

  // Sort by score and return the best match
  scoredSizes.sort((a, b) => b.score - a.score);
  return scoredSizes[0].size;
}

/**
 * Detect network speed (simplified - you might want to use Network Information API)
 */
function getNetworkSpeed(): "fast" | "slow" | "unknown" {
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === "slow-2g" || effectiveType === "2g") return "slow";
      if (effectiveType === "3g") return "slow";
      if (effectiveType === "4g") return "slow";
      return "fast";
    }
  }
  return "unknown";
}

/**
 * Generate responsive srcset string for better browser selection
 */
function generateSrcSet(thumbnailUrls: ThumbnailUrls): string {
  const srcSetEntries: string[] = [];

  Object.entries(THUMBNAIL_CONFIGS).forEach(([size, config]) => {
    const url = thumbnailUrls[size as ThumbnailSize];
    if (url && config.width !== Infinity) {
      srcSetEntries.push(`${url} ${config.width}w`);
    }
  });

  return srcSetEntries.join(", ");
}

/**
 * Generate optimized picture sources with better breakpoints
 */
function generateOptimizedSources(
  thumbnailUrls: ThumbnailUrls | undefined
): Array<{ media: string; srcSet: string; type?: string }> {
  if (!thumbnailUrls) return [];

  const sources: Array<{ media: string; srcSet: string; type?: string }> = [];
  const srcSet = generateSrcSet(thumbnailUrls);

  if (!srcSet) return [];

  // Define viewport-based breakpoints with DPR considerations
  const breakpoints = [
    {
      media: "(max-width: 480px)",
      sizes: "(max-width: 480px) 100vw",
      candidates: ["small", "medium", "cover"] as ThumbnailSize[],
    },
    {
      media: "(max-width: 768px)",
      sizes: "(max-width: 768px) 100vw",
      candidates: ["medium", "large", "small"] as ThumbnailSize[],
    },
    {
      media: "(max-width: 1024px)",
      sizes: "(max-width: 1024px) 50vw",
      candidates: ["large", "xlarge", "medium"] as ThumbnailSize[],
    },
    {
      media: "(min-width: 1025px)",
      sizes: "(min-width: 1025px) 33vw",
      candidates: ["xlarge", "originalSize", "large"] as ThumbnailSize[],
    },
  ];

  // Add high-DPR specific sources
  const highDprBreakpoints = [
    {
      media: "(-webkit-min-device-pixel-ratio: 2) and (max-width: 768px)",
      candidates: ["large", "xlarge", "medium"] as ThumbnailSize[],
    },
    {
      media: "(-webkit-min-device-pixel-ratio: 2) and (min-width: 769px)",
      candidates: ["xlarge", "originalSize", "large"] as ThumbnailSize[],
    },
  ];

  [...breakpoints, ...highDprBreakpoints].forEach((breakpoint) => {
    const availableCandidates = breakpoint.candidates.filter(
      (size) => thumbnailUrls[size]
    );

    if (availableCandidates.length > 0) {
      const srcSetForBreakpoint = availableCandidates
        .map((size) => {
          const config = THUMBNAIL_CONFIGS[size];
          const url = thumbnailUrls[size];
          return config.width !== Infinity ? `${url} ${config.width}w` : url;
        })
        .join(", ");

      sources.push({
        media: breakpoint.media,
        srcSet: srcSetForBreakpoint,
      });
    }
  });

  return sources;
}

export const ResponsivePicture: React.FC<ResponsivePictureProps> = ({
  thumbnailUrls,
  fallbackUrl,
  alt,
  className,
  loading = "lazy",
  onClick,
  priority = "balanced",
  aspectRatio,
}) => {
  const { containerRef, dimensions } = useContainerDimensions();

  // Memoize expensive calculations
  const optimalThumbnail = useMemo(() => {
    return selectOptimalThumbnail(
      dimensions.width,
      dimensions.height,
      thumbnailUrls,
      priority,
      aspectRatio
    );
  }, [
    dimensions.width,
    dimensions.height,
    thumbnailUrls,
    priority,
    aspectRatio,
  ]);

  const sources = useMemo(() => {
    return generateOptimizedSources(thumbnailUrls);
  }, [thumbnailUrls]);

  const defaultSrc = useMemo(() => {
    if (optimalThumbnail && thumbnailUrls?.[optimalThumbnail]) {
      return thumbnailUrls[optimalThumbnail];
    }
    return fallbackUrl;
  }, [optimalThumbnail, thumbnailUrls, fallbackUrl]);

  // Generate sizes attribute for responsive loading
  const sizesAttribute = useMemo(() => {
    if (dimensions.width === 0) return undefined;

    // Create responsive sizes based on container
    const viewportPercentage = Math.min(
      100,
      (dimensions.width / window.innerWidth) * 100
    );
    return `(max-width: 768px) 100vw, (max-width: 1200px) ${Math.round(
      viewportPercentage
    )}vw, ${dimensions.width}px`;
  }, [dimensions.width]);

  // Generate srcset for img element
  const imgSrcSet = useMemo(() => {
    if (!thumbnailUrls) return undefined;
    return generateSrcSet(thumbnailUrls);
  }, [thumbnailUrls]);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // Early return for missing thumbnails
  if (!thumbnailUrls || Object.keys(thumbnailUrls).length === 0) {
    return (
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="w-full h-full"
      >
        <img
          src={fallbackUrl}
          alt={alt}
          className={className}
          loading={loading}
          onClick={handleClick}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="w-full h-full"
    >
      <picture onClick={handleClick}>
        {sources.map((source, index) => (
          <source
            key={index}
            media={source.media}
            srcSet={source.srcSet}
            type={source.type}
          />
        ))}
        <img
          src={defaultSrc}
          srcSet={imgSrcSet}
          sizes={sizesAttribute}
          alt={alt}
          className={className}
          loading={loading}
          width={dimensions.width || undefined}
          height={dimensions.height || undefined}
          decoding="async"
        />
      </picture>
    </div>
  );
};

export default ResponsivePicture;
