"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { VirtualizedGrid } from "./ui/VirtualizedGrid";
import { useAlbumMedia } from "@/hooks/queries/useMediaQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { useBulkViewCounts } from "@/hooks/queries/useViewCountsQuery";

interface MediaGalleryProps {
  albumId: string;
  className?: string;
  canRemoveFromAlbum?: boolean; // New prop to control removal from album
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  albumId,
  className,
  canRemoveFromAlbum,
}) => {
  // Use TanStack Query to fetch album media with caching and optimistic updates
  const {
    data: mediaData,
    isLoading,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAlbumMedia({ albumId, limit: 20 });

  // Extract all media from paginated data
  const allMedia = useMemo(() => {
    return mediaData?.pages.flatMap((page) => page.media || []) || [];
  }, [mediaData]);

  // Manage error state
  const [error, setError] = useState<string | null>(
    queryError?.message || null
  );

  // Hook for manual prefetching (for interaction status)
  const { prefetch } = usePrefetchInteractionStatus();

  // Memoize all media targets for prefetching
  const allMediaTargets = useMemo(
    () =>
      allMedia.map((mediaItem) => ({
        targetType: "media" as const,
        targetId: mediaItem.id,
      })),
    [allMedia]
  );

  // Bulk prefetch view counts for the album and all media
  const viewCountTargets = useMemo(() => {
    const targets: Array<{ targetType: "album" | "media"; targetId: string }> =
      [{ targetType: "album", targetId: albumId }];

    // Add media targets
    allMedia.forEach((media) => {
      targets.push({ targetType: "media", targetId: media.id });
    });

    return targets;
  }, [albumId, allMedia]);

  // Prefetch view counts in the background
  useBulkViewCounts(viewCountTargets, { enabled: viewCountTargets.length > 0 });

  // Auto-prefetch interaction status for all loaded media
  useLayoutEffect(() => {
    if (allMediaTargets.length > 0) {
      prefetch(allMediaTargets).catch((error) => {
        console.error("Failed to prefetch media interaction status:", error);
      });
    }
  }, [allMediaTargets, prefetch]);

  // Update local error state when query error changes
  useEffect(() => {
    if (queryError?.message) {
      setError(queryError.message);
    } else {
      setError(null);
    }
  }, [queryError]);

  const handleLoadMore = async () => {
    if (!hasNextPage || isFetchingNextPage) return;

    setError(null);
    try {
      await fetchNextPage();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more media"
      );
    }
  };

  return (
    <>
      <VirtualizedGrid
        items={allMedia}
        className={className}
        viewMode="grid"
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={handleLoadMore}
        gridColumns={{
          mobile: 1,
          sm: 2,
          md: 3,
          lg: 4,
          xl: 4,
        }}
        contentCardProps={{
          canLike: true,
          canBookmark: true,
          canFullscreen: true,
          canAddToAlbum: true,
          canDownload: true,
          canDelete: false,
          canRemoveFromAlbum: canRemoveFromAlbum,
          currentAlbumId: albumId,
        }}
        mediaList={allMedia}
        emptyState={{
          icon: (
            <svg
              className="w-16 h-16 mx-auto text-muted-foreground mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          ),
          title: "No media found",
          description: "This album doesn't contain any media files yet.",
        }}
        loadingState={{
          loadingText: "Loading more media...",
          noMoreText: "No more media to load",
        }}
        error={error}
        onRetry={handleLoadMore}
      />
    </>
  );
};
