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
  const prevTag = useRef<string | undefined>(tag);

  // For pages with tags, we need fresh data since SSG doesn't pre-render all tag combinations
  // For the main discover page (no tag), we can use the SSG initial data
  const shouldUseInitialData =
    !tag && !initialTag && initialContent?.length > 0;

  // Use TanStack Query with infinite scroll and initial data from SSG/ISR
  // This approach:
  // 1. Uses server-rendered data for instant loading on main page (no tag filtering)
  // 2. Falls back to client-side fetching for dynamic tag filtering
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
    // Pass initial data only for non-tagged requests
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

  // Force refetch when tag changes (but not on initial load)
  useEffect(() => {
    if (prevTag.current !== tag) {
      // Only refetch if this isn't the initial render
      if (prevTag.current !== undefined) {
        refetch();
      }
      prevTag.current = tag;
    }
  }, [tag, refetch]);

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
        {tag && (
          <ComponentErrorBoundary context="Tag Filter">
            <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-4 border border-admin-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <svg
                      className="w-5 h-5 text-admin-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-foreground font-medium">
                      Filtering by tag:
                    </span>
                  </div>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-admin-primary text-admin-primary-foreground">
                    {tag}
                  </span>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="text-admin-primary hover:text-admin-primary/80 transition-colors text-sm font-medium"
                >
                  Clear filter
                </button>
              </div>
            </div>
          </ComponentErrorBoundary>
        )}

        <SectionErrorBoundary context="Content Grid">
          <ContentGrid
            items={items}
            loadMore={loadMore}
            loading={isActuallyLoading || isFetchingNextPage}
            hasMore={true}
            error={displayError}
          />
        </SectionErrorBoundary>
      </div>
    </SectionErrorBoundary>
  );
}
