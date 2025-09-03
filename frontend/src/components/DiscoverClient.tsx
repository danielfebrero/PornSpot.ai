"use client";

import { ContentGrid } from "./ContentGrid";
import { useBulkViewCounts } from "@/hooks/queries/useViewCountsQuery";
import { Album, DiscoverCursors, Media } from "@/types";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { useEffect, useRef, useMemo } from "react";
import {
  SectionErrorBoundary,
  ComponentErrorBoundary,
} from "./ErrorBoundaries";
import { useDiscover } from "@/hooks/queries/useDiscoverQuery";
import { useTranslations } from "next-intl";
import { SortTabs, SortMode } from "./ui/SortTabs";

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
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const tag = searchParams.get("tag") || initialTag || undefined;
  const sort = (searchParams.get("sort") as SortMode) || "discover";
  const prevTag = useRef<string | undefined>(tag);
  const prevSort = useRef<SortMode>(sort);
  const t = useTranslations("discover");

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
    // Note: sort parameter will be added to the API later
    // Pass initial data only for non-tagged, default sort requests
    ...(shouldUseInitialData && {
      initialData: {
        items: initialContent,
        cursors: initialPagination || undefined,
      },
    }),
  });

  // Flatten all pages into a single items array
  const items = useMemo(() => {
    return data?.pages.flatMap((page) => page.items || []) || [];
  }, [data]);

  // Bulk prefetch view counts for all items (for SSG pages)
  const viewCountTargets = useMemo(() => {
    return items.map((item) => ({
      targetType: item.type,
      targetId: item.id,
    }));
  }, [items]);

  // Prefetch view counts in the background
  useBulkViewCounts(viewCountTargets, { enabled: viewCountTargets.length > 0 });

  // Force refetch when tag or sort changes (but not on initial load)
  useEffect(() => {
    if (prevTag.current !== tag || prevSort.current !== sort) {
      // Only refetch if this isn't the initial render
      if (prevTag.current !== undefined || prevSort.current !== undefined) {
        refetch();
      }
      prevTag.current = tag;
      prevSort.current = sort;
    }
  }, [tag, sort, refetch]);

  // LoadMore function for AlbumGrid
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
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

  return (
    <SectionErrorBoundary context="Discover Page">
      <div className="space-y-6">
        {/* Sort Navigation Tabs */}
        <ComponentErrorBoundary context="Sort Tabs">
          <SortTabs />
        </ComponentErrorBoundary>

        <SectionErrorBoundary context="Content Grid">
          <ContentGrid
            items={items}
            loadMore={loadMore}
            loading={isActuallyLoading || isFetchingNextPage}
            hasMore={hasNextPage}
            error={displayError}
            scrollRestorationKey="discover-content-grid"
          />
        </SectionErrorBoundary>
      </div>
    </SectionErrorBoundary>
  );
}
