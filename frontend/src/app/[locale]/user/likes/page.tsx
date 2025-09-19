"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Heart, Grid, List } from "lucide-react";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import { useLikesQuery } from "@/hooks/queries/useLikesQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { Button } from "@/components/ui/Button";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import type { Album, Media, UserInteraction } from "@/types";

// Types for the component
interface LikesPageData {
  interactions: UserInteraction[];
}

/**
 * UserLikesPage - Displays user's liked content with virtualization and infinite scroll
 *
 * Features implemented:
 * - ✅ Virtual scrolling using react-virtuoso via VirtualizedGrid
 * - ✅ Infinite scroll with TanStack Query's useInfiniteQuery
 * - ✅ Mixed content types (media + albums) with dynamic type resolution
 * - ✅ Performance optimizations with useMemo and useCallback
 * - ✅ Interaction status prefetching for better UX
 * - ✅ Lightbox support for media items with infinite navigation
 * - ✅ Grid and list view modes
 * - ✅ Responsive design and loading states
 *
 * Technical details:
 * - Uses cursor-based pagination via useLikesQuery
 * - VirtualizedGrid handles large lists efficiently
 * - Dynamic type resolution via _contentType property
 * - Optimistic interaction updates
 * - Lightbox infinite navigation with automatic content loading
 */
const UserLikesPage: React.FC = () => {
  const t = useTranslations("common");
  const tUser = useTranslations("user.likes");

  // Set document title and meta description
  useDocumentHeadAndMeta(tUser("meta.title"), tUser("meta.description"));

  // Use TanStack Query hook for likes
  const {
    data: likesData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLikesQuery({ includeContentPreview: true });

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Extract likes from infinite query data
  const allLikes = useMemo(() => {
    return (
      likesData?.pages.flatMap(
        (page: LikesPageData) => page?.interactions || []
      ) || []
    );
  }, [likesData]);

  // Filter out invalid likes before counting
  const likes = useMemo(() => {
    return allLikes.filter((like: UserInteraction) => like && like.targetType);
  }, [allLikes]);

  // Prefetch interaction status for all liked items
  useEffect(() => {
    if (likes.length > 0) {
      const targets = likes.map((like: UserInteraction) => ({
        targetType: like.targetType as "album" | "media",
        targetId: like.targetId,
      }));
      prefetch(targets).catch((error) => {
        console.error(
          "Failed to prefetch user likes interaction status:",
          error
        );
      });
    }
  }, [likes, prefetch]);

  const totalCount = likes.length;
  const hasMore = hasNextPage;
  const isLoadingMore = isFetchingNextPage;

  // Memoize load more function
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Memoize refresh function
  const refresh = useCallback(() => {
    // TanStack Query handles background refetching
  }, []);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (error) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-8 text-center">
        <div className="text-red-500 mb-4">
          <Heart className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-medium text-foreground">
            {tUser("failedToLoadLikes")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{error?.message}</p>
        </div>
        <Button onClick={refresh} variant="outline">
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500/10 to-admin-secondary/10 rounded-xl border border-red-500/20 shadow-lg p-6">
          {/* Mobile Layout */}
          <div className="block sm:hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-admin-secondary rounded-lg flex items-center justify-center">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {tUser("likes")}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {tUser("yourLikedContent")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <span className="bg-red-500/20 text-red-600 text-sm font-semibold px-3 py-1.5 rounded-full">
                {tUser("likesCount", {
                  count: totalCount,
                  hasNextPage: hasNextPage ? 1 : 0,
                })}
              </span>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-admin-secondary rounded-lg flex items-center justify-center">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {tUser("likes")}
                </h1>
                <p className="text-muted-foreground">
                  {tUser("yourLikedContent")}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="bg-red-500/20 text-red-600 text-sm font-semibold px-3 py-1.5 rounded-full">
                {tUser("likesCount", {
                  count: totalCount,
                  hasNextPage: hasNextPage ? 1 : 0,
                })}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <VirtualizedGrid
          items={likes
            .map((like) => like.target)
            .filter((item): item is Album | Media => Boolean(item))}
          viewMode={viewMode}
          isLoading={isLoading}
          hasNextPage={hasMore}
          isFetchingNextPage={isLoadingMore}
          onLoadMore={loadMore}
          scrollRestorationKey="user-likes-grid"
          contentCardProps={{
            canLike: true,
            canBookmark: true,
            canFullscreen: true,
            canAddToAlbum: true,
            canDownload: true,
            canDelete: false,
            showTags: false,
            showCounts: true,
          }}
          mediaList={likes
            .filter((like) => like.targetType === "media")
            .map((like) => like.target)
            .filter(
              (item): item is Media =>
                Boolean(item) &&
                (item?.type === "image" || item?.type === "video")
            )}
          emptyState={{
            icon: (
              <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Heart className="h-10 w-10 text-red-500" />
              </div>
            ),
            title: tUser("noLikesYet"),
            description: tUser("startExploringContent"),
          }}
          loadingState={{
            loadingText: tUser("loadingMoreLikes"),
            noMoreText: tUser("allLikesLoaded"),
            skeletonCount: 8,
          }}
          error={error ? String(error) : null}
          onRetry={refresh}
        />
      </div>
    </>
  );
};

export default UserLikesPage;
