"use client";

import { ContentGrid } from "./ContentGrid";
import { VideoRow } from "./ui/VideoRow";
import { AlbumRow } from "./ui/AlbumRow";
import { useBulkViewCounts } from "@/hooks/queries/useViewCountsQuery";
import { Album, DiscoverCursors, Media } from "@/types";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  SectionErrorBoundary,
  ComponentErrorBoundary,
} from "./ErrorBoundaries";
import { useDiscover, useDiscoverVideos } from "@/hooks/queries/useDiscoverQuery";
import { SortTabs, SortMode } from "./ui/SortTabs";
import { Image as ImageIcon } from "lucide-react";

interface DiscoverClientProps {
  initialContent: (Album | Media)[];
  initialPagination: DiscoverCursors | null;
  initialError: string | null;
  initialTag?: string; // Add optional initialTag prop
}

export function DiscoverClient({
  initialContent,
  initialPagination,
  initialError,
  initialTag,
}: DiscoverClientProps) {
  const t = useTranslations("discover");
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag") || initialTag || undefined;
  const sort = (searchParams.get("sort") as SortMode) || "discover";
  const prevTag = useRef<string | undefined>(tag);
  const prevSort = useRef<SortMode>(sort);

  // For pages with tags or non-default sort, we need fresh data since SSG doesn't pre-render all combinations
  // For the main discover page (no tag, default sort), we can use the SSG initial data
  const shouldUseInitialData =
    !tag && !initialTag && sort === "discover" && initialContent?.length > 0;

  // Use TanStack Query with infinite scroll and initial data from SSG/ISR
  // This approach:
  // 1. Uses server-rendered data for instant loading on main page (no tag filtering, default sort)
  // 2. Falls back to client-side fetching for dynamic tag filtering or sort changes
  // 3. Provides seamless infinite scroll from the initial data
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useDiscover({
    limit: 20,
    tag,
    sort: sort === "discover" ? undefined : sort, // Only pass non-default sort values
    // Pass initial data only for non-tagged, default sort requests
    ...(shouldUseInitialData && {
      initialData: {
        items: initialContent,
        cursors: initialPagination || undefined,
      },
    }),
  });

  // Fetch videos separately for the video row
  const {
    data: videosData,
    isLoading: isLoadingVideos,
    fetchNextPage: fetchNextVideos,
    hasNextPage: hasNextVideos,
    isFetchingNextPage: isFetchingNextVideos,
    refetch: refetchVideos,
  } = useDiscoverVideos({
    limit: 10,
    sort: sort === "discover" ? undefined : sort,
    enabled: !tag, // Only fetch videos when not filtering by tag
  });

  // Flatten all pages into a single items array
  const items = useMemo(() => {
    return data?.pages.flatMap((page) => page.items || []) || [];
  }, [data]);

  // Flatten videos from all pages
  const videos = useMemo(() => {
    return (videosData?.pages.flatMap((page) => page.items || []) || []) as Media[];
  }, [videosData]);

  // Auto-fetch more videos if we have less than 4 but there's more data available
  // This ensures the video row is always filled on initial load
  const MIN_VIDEOS_FOR_ROW = 4;
  useEffect(() => {
    if (
      !isLoadingVideos &&
      !isFetchingNextVideos &&
      videos.length < MIN_VIDEOS_FOR_ROW &&
      hasNextVideos
    ) {
      fetchNextVideos();
    }
  }, [videos.length, isLoadingVideos, isFetchingNextVideos, hasNextVideos, fetchNextVideos]);

  // Separate albums from the main items for the AlbumRow
  const albums = useMemo(() => {
    return items.filter((item): item is Album => item.type === "album");
  }, [items]);

  // Filter items to get only images (exclude ALL videos and albums)
  const images = useMemo(() => {
    // Filter to keep only images (not videos, not albums)
    return items.filter((item): item is Media => {
      // Exclude albums (they have their own row)
      if (item.type === "album") return false;
      // Exclude ALL videos (they have their own row)
      if (item.type === "video") return false;
      // Keep images
      return item.type === "image";
    });
  }, [items]);

  // Bulk prefetch view counts for all items (for SSG pages)
  const viewCountTargets = useMemo(() => {
    const allItems = [...items, ...videos];
    return allItems.map((item) => ({
      targetType: item.type,
      targetId: item.id,
    }));
  }, [items, videos]);

  // Prefetch view counts in the background
  useBulkViewCounts(viewCountTargets, { enabled: viewCountTargets.length > 0 });

  // Force refetch when tag or sort changes (but not on initial load)
  useEffect(() => {
    if (prevTag.current !== tag || prevSort.current !== sort) {
      // Only refetch if this isn't the initial render
      if (prevTag.current !== undefined || prevSort.current !== undefined) {
        refetch();
        if (!tag) {
          refetchVideos();
        }
      }
      prevTag.current = tag;
      prevSort.current = sort;
    }
  }, [tag, sort, refetch, refetchVideos]);

  // LoadMore function for ContentGrid (images/albums)
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // LoadMore function for VideoRow
  const loadMoreVideos = () => {
    if (hasNextVideos && !isFetchingNextVideos) {
      fetchNextVideos();
    }
  };

  // Determine loading state - don't show loading on first render if we have initial data
  const isActuallyLoading = isLoading && !shouldUseInitialData;

  // Use initial error if no albums were loaded and we have an error
  const displayError = useMemo(() => {
    // Prioritize initial error for SSG/ISR pages
    if (items.length === 0 && initialError) {
      return initialError;
    }

    // Use query error if available
    if (error?.message) {
      return error.message;
    }

    return null;
  }, [items.length, initialError, error]);

  const scrollRestorationKey = useMemo(() => {
    const tagKey = tag ? `tag-${encodeURIComponent(tag)}` : "tag-all";
    const sortKey = `sort-${sort ?? "discover"}`;
    return `discover-content-grid-${tagKey}-${sortKey}`;
  }, [tag, sort]);

  // Determine if we should show the video/album sections
  // - Not when filtering by tag (tags are album-specific)
  const showVideoSection = !tag;

  return (
    <SectionErrorBoundary context="Discover Page">
      {/* Sort Navigation Tabs */}
      <ComponentErrorBoundary context="Sort Tabs">
        <div className="flex justify-center md:justify-start">
          <SortTabs />
        </div>
      </ComponentErrorBoundary>

      {/* Video Row Section */}
      {showVideoSection && (
        <SectionErrorBoundary context="Video Row">
          <VideoRow
            videos={videos}
            isLoading={isLoadingVideos}
            hasMore={hasNextVideos}
            onLoadMore={loadMoreVideos}
            isFetchingNextPage={isFetchingNextVideos}
            scrollRestorationKey={`${scrollRestorationKey}-videos`}
          />
        </SectionErrorBoundary>
      )}

      {/* Album Row Section */}
      {showVideoSection && (
        <SectionErrorBoundary context="Album Row">
          <AlbumRow
            albums={albums}
            isLoading={isActuallyLoading}
            hasMore={hasNextPage}
            onLoadMore={loadMore}
            isFetchingNextPage={isFetchingNextPage}
            scrollRestorationKey={`${scrollRestorationKey}-albums`}
          />
        </SectionErrorBoundary>
      )}

      {/* Images Section */}
      <SectionErrorBoundary context="Content Grid">
        {showVideoSection && images.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("images")}
            </h2>
          </div>
        )}
        <ContentGrid
          items={showVideoSection ? images : items}
          loadMore={loadMore}
          loading={isActuallyLoading || isFetchingNextPage}
          hasMore={hasNextPage}
          error={displayError}
          scrollRestorationKey={scrollRestorationKey}
        />
      </SectionErrorBoundary>
    </SectionErrorBoundary>
  );
}
