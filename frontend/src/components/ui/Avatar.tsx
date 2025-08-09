"use client";

import { useState, useEffect } from "react";
import { User } from "@/types";
import { composeMediaUrl } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import { useContainerDimensions } from "@/hooks/useContainerDimensions";

// Flexible user interface that works with both User and extended user types
interface AvatarUser {
  userId?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  avatarThumbnails?: {
    originalSize?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
}

interface AvatarProps {
  user: User | AvatarUser;
  size?: "small" | "medium" | "large" | "xlarge" | "custom";
  className?: string;
  showOnlineIndicator?: boolean;
  // Custom sizing for responsive avatars - when size="custom", these take precedence
  customSizeClasses?: string;
  customTextClasses?: string;
}

// Avatar thumbnail configurations matching backend
const AVATAR_THUMBNAIL_CONFIGS = {
  small: { width: 32, height: 32, quality: 85 },
  medium: { width: 96, height: 96, quality: 90 },
  large: { width: 128, height: 128, quality: 95 },
  originalSize: { width: Infinity, height: Infinity, quality: 95 },
} as const;

/**
 * Intelligently select the best avatar thumbnail size based on container dimensions
 * Uses device pixel ratio for high-DPI displays
 */
function selectOptimalAvatarSize(
  containerWidth: number,
  containerHeight: number,
  avatarThumbnails?: Record<string, string | undefined>
): keyof typeof AVATAR_THUMBNAIL_CONFIGS | null {
  if (!avatarThumbnails) return null;

  // Get device pixel ratio for high-DPI displays
  const devicePixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Use the larger dimension (avatars are circular/square)
  const targetSize =
    Math.max(containerWidth, containerHeight) * devicePixelRatio;

  // Get available avatar sizes sorted by preference
  const availableSizes = Object.keys(
    avatarThumbnails
  ) as (keyof typeof AVATAR_THUMBNAIL_CONFIGS)[];

  // Create preference mapping - prefer sizes that are close to but larger than needed
  const sizePreferences = availableSizes
    .map((size) => {
      const config = AVATAR_THUMBNAIL_CONFIGS[size];
      if (!config) return null;

      const avatarSize = config.width;

      // Score based on how well the avatar size fits the container
      let score = 0;

      if (avatarSize >= targetSize) {
        // Prefer sizes that are larger than needed but not too much larger
        const excess = avatarSize - targetSize;
        const excessRatio = excess / targetSize;

        if (excessRatio <= 0.5) {
          // Within 50% - excellent match
          score = 1000 - excessRatio * 100;
        } else if (excessRatio <= 1.0) {
          // Within 100% - good match
          score = 800 - excessRatio * 100;
        } else {
          // More than 100% larger - penalize but still usable
          score = 600 - Math.min(excessRatio * 50, 400);
        }
      } else {
        // Size is smaller than needed - penalize based on how much smaller
        const deficit = targetSize - avatarSize;
        const deficitRatio = deficit / targetSize;
        score = 500 - deficitRatio * 200;
      }

      // Quality bonus
      score += config.quality;

      return { size, avatarSize, score };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  // Return the best match, or fall back to best available
  if (sizePreferences.length > 0) {
    return sizePreferences[0]!.size;
  }

  // Fallback order if no perfect matches
  const fallbackOrder: (keyof typeof AVATAR_THUMBNAIL_CONFIGS)[] = [
    "medium",
    "large",
    "small",
    "originalSize",
  ];
  for (const size of fallbackOrder) {
    if (avatarThumbnails[size]) {
      return size;
    }
  }

  return null;
}

/**
 * Avatar component for displaying user avatars with automatic fallback to initials
 *
 * Features:
 * - Intelligent container dimension-based avatar thumbnail selection
 * - Responsive avatar thumbnails with optimal size selection
 * - Automatic fallback to user initials if no avatar
 * - Shows initials as placeholder while image is loading
 * - Consistent styling across the application
 * - Support for online indicators
 * - Flexible user type support (works with User and extended user types)
 * - Custom responsive sizing support for special cases
 *
 * Size mapping (backward compatibility, but intelligent selection overrides):
 * - small: 32px (w-8 h-8) - for small UI elements, header menu
 * - medium: 48px (w-12 h-12) - for regular UI elements
 * - large: 64px (w-16 h-16) - for profile cards, user info
 * - xlarge: 96px (w-24 h-24) - for profile headers, large displays
 * - custom: Use customSizeClasses and customTextClasses props for responsive sizing
 */
export function Avatar({
  user,
  size = "medium",
  className,
  showOnlineIndicator = false,
  customSizeClasses,
  customTextClasses,
}: AvatarProps) {
  const { containerRef, dimensions } = useContainerDimensions();
  const containerWidth = dimensions.width;
  const containerHeight = dimensions.height;

  // Track image loading state
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [hasImageError, setHasImageError] = useState(false);

  const displayName =
    user.username || (user.email ? user.email.split("@")[0] : "Anonymous");
  const initials = displayName.slice(0, 2).toUpperCase();

  // Intelligently determine which avatar to use based on container dimensions
  const getAvatarUrl = () => {
    if (!user.avatarThumbnails && !user.avatarUrl) return null;

    // Use intelligent selection if container dimensions are available
    if (containerWidth > 0 && containerHeight > 0 && user.avatarThumbnails) {
      const optimalSize = selectOptimalAvatarSize(
        containerWidth,
        containerHeight,
        user.avatarThumbnails
      );
      if (optimalSize && user.avatarThumbnails[optimalSize]) {
        return user.avatarThumbnails[optimalSize];
      } else {
        return user.avatarUrl;
      }
    } else {
      // Fallback to original avatar URL if no thumbnails available
      return user.avatarUrl || null;
    }
  };

  const avatarUrl = getAvatarUrl();

  // Reset loading state when URL changes
  useEffect(() => {
    if (avatarUrl) {
      setIsImageLoading(true);
      setHasImageError(false);
    }
  }, [avatarUrl]);

  // Size class mapping
  const sizeClasses = {
    small: "w-8 h-8 text-sm",
    medium: "w-12 h-12 text-base",
    large: "w-16 h-16 text-lg",
    xlarge: "w-24 h-24 text-xl",
  };

  // Get appropriate size classes
  const getSizeClasses = () => {
    if (size === "custom" && customSizeClasses) {
      return customSizeClasses;
    }
    return sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium;
  };

  // Get appropriate text classes
  const getTextClasses = () => {
    if (size === "custom" && customTextClasses) {
      return customTextClasses;
    }
    return ""; // Text size is included in sizeClasses for non-custom sizes
  };

  const handleImageLoad = () => {
    setIsImageLoading(false);
    setHasImageError(false);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
    setHasImageError(true);
  };

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={cn("relative inline-block", className)}
    >
      <div
        className={cn(
          "bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium overflow-hidden shadow-sm",
          getSizeClasses(),
          getTextClasses()
        )}
      >
        {avatarUrl && !hasImageError ? (
          <>
            {/* Show initials while loading */}
            {isImageLoading && <span className="select-none">{initials}</span>}
            {/* The actual image - hidden during loading */}
            <img
              src={composeMediaUrl(avatarUrl)}
              alt={`${displayName}'s avatar`}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-200",
                isImageLoading ? "opacity-0 absolute" : "opacity-100"
              )}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
        ) : (
          // Show initials when no avatar URL or image error
          initials
        )}
      </div>

      {showOnlineIndicator && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
      )}
    </div>
  );
}

export default Avatar;
