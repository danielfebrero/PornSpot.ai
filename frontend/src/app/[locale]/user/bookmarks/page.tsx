"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Bookmark, Grid, List } from "lucide-react";
import { useBookmarksQuery } from "@/hooks/queries/useBookmarksQuery";
import { Button } from "@/components/ui/Button";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import type { UserInteraction, Album, Media } from "@/types";

// Types for the component
interface BookmarkPageData {
  interactions: UserInteraction[];
}

const UserBookmarksPage: React.FC = () => {
  // Create media items for ContentCard from bookmarks
  const createMediaFromBookmark = useCallback(
    (bookmark: UserInteraction): Media | null => {
      if (!bookmark || !bookmark.targetType) {
        return null;
      }
      if (bookmark.targetType === "media") {
        const target = bookmark.target as Media | undefined;
        return {
          id: bookmark.targetId,
          filename: target?.filename || "",
          originalFilename: target?.originalFilename || "",
          type: "media",
          mimeType: target?.mimeType || "image/jpeg",
          size: target?.size || 0,
          width: target?.width,
          height: target?.height,
          url: target?.url || "",
          thumbnailUrl: target?.thumbnailUrl || "",
          thumbnailUrls: target?.thumbnailUrls,
          status: target?.status,
          createdAt: bookmark.createdAt,
          updatedAt: bookmark.createdAt,
          likeCount: target?.likeCount,
          bookmarkCount: target?.bookmarkCount,
          viewCount: target?.viewCount || 0,
          commentCount: target?.commentCount,
          metadata: target?.metadata,
          createdBy: target?.createdBy,
          createdByType: target?.createdByType,
        };
      }
      return null;
    },
    []
  );

  // Create album items for ContentCard from bookmarks
  const createAlbumFromBookmark = useCallback(
    (bookmark: UserInteraction): Album | null => {
      if (!bookmark || !bookmark.targetType) {
        return null;
      }
      if (bookmark.targetType === "album") {
        const target = bookmark.target as Album | undefined;
        return {
          id: bookmark.targetId,
          title: target?.title || `Album ${bookmark.targetId}`,
          type: "album",
          coverImageUrl: target?.coverImageUrl || "",
          thumbnailUrls: target?.thumbnailUrls,
          mediaCount: target?.mediaCount || 0,
          tags: target?.tags || [],
          isPublic: target?.isPublic || false,
          viewCount: target?.viewCount || 0,
          likeCount: target?.likeCount,
          bookmarkCount: target?.bookmarkCount,
          commentCount: target?.commentCount,
          createdAt: bookmark.createdAt,
          updatedAt: bookmark.createdAt,
          createdBy: target?.createdBy,
          createdByType: target?.createdByType,
        };
      }
      return null;
    },
    []
  );

  // Use TanStack Query hook for bookmarks
  const {
    data: bookmarksData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBookmarksQuery();

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Extract bookmarks from infinite query data
  const allBookmarks =
    bookmarksData?.pages.flatMap(
      (page: BookmarkPageData) => page.interactions || []
    ) || [];

  // Filter out invalid bookmarks before counting
  const bookmarks = allBookmarks.filter(
    (bookmark): bookmark is UserInteraction =>
      bookmark && bookmark.targetType !== undefined
  );

  // Extract bookmarks and create consistent items for VirtualizedGrid with type information
  const allBookmarkItems = useMemo((): (Album | Media)[] => {
    return bookmarks
      .map((bookmark: UserInteraction) => {
        const media = createMediaFromBookmark(bookmark);
        const album = createAlbumFromBookmark(bookmark);
        return media || album;
      })
      .filter((item): item is Album | Media => item !== null);
  }, [bookmarks, createMediaFromBookmark, createAlbumFromBookmark]);

  // Prefetch interaction status for all bookmarked items
  useEffect(() => {
    if (bookmarks.length > 0) {
      const targets = bookmarks.map((bookmark: UserInteraction) => ({
        targetType: bookmark.targetType as "album" | "media",
        targetId: bookmark.targetId,
      }));
      prefetch(targets).catch((error) => {
        console.error(
          "Failed to prefetch user bookmarks interaction status:",
          error
        );
      });
    }
  }, [bookmarks, prefetch]);

  const totalCount = allBookmarkItems.length;
  const hasMore = hasNextPage;
  const isLoadingMore = isFetchingNextPage;
  const loadMore = () => fetchNextPage();
  const refresh = () => {}; // TanStack Query handles background refetching

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (error) {
    return (
      <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-8 text-center">
        <div className="text-admin-primary mb-4">
          <Bookmark className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-medium text-foreground">
            Failed to load bookmarks
          </p>
          <p className="text-sm text-muted-foreground mt-1">{error?.message}</p>
        </div>
        <Button onClick={refresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500/10 to-admin-secondary/10 rounded-xl border border-blue-500/20 shadow-lg p-6">
          {/* Mobile Layout */}
          <div className="block sm:hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-admin-secondary rounded-lg flex items-center justify-center">
                  <Bookmark className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Bookmarks
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Your saved favorites
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <span className="bg-blue-500/20 text-blue-600 text-sm font-semibold px-3 py-1.5 rounded-full">
                {totalCount.toLocaleString()} bookmarks
              </span>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-admin-secondary rounded-lg flex items-center justify-center">
                <Bookmark className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Bookmarks
                </h1>
                <p className="text-muted-foreground">Your saved favorites</p>
              </div>
              <span className="bg-blue-500/20 text-blue-600 text-sm font-semibold px-3 py-1.5 rounded-full">
                {totalCount.toLocaleString()} bookmarks
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
          items={allBookmarkItems}
          viewMode={viewMode}
          isLoading={isLoading}
          hasNextPage={hasMore}
          isFetchingNextPage={isLoadingMore}
          onLoadMore={loadMore}
          contentCardProps={{
            canLike: true,
            canBookmark: true,
            canFullscreen: true,
            canAddToAlbum: true,
            canDownload: true,
            canDelete: false,
          }}
          mediaList={allBookmarkItems.filter(
            (item): item is Media => item.type === "media"
          )}
          emptyState={{
            icon: (
              <Bookmark className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            ),
            title: "No bookmarks yet",
            description:
              "Start exploring content and bookmark what you want to save for later!",
          }}
          loadingState={{
            loadingText: "Loading more bookmarks...",
            noMoreText: "No more bookmarks to load",
          }}
          error={error ? String(error) : null}
          onRetry={refresh}
        />
      </div>
    </>
  );
};

export default UserBookmarksPage;
