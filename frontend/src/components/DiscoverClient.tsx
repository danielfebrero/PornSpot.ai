"use client";

import { AlbumGrid } from "./AlbumGrid";
import { useAlbums } from "@/hooks/queries/useAlbumsQuery";
import { Album } from "@/types";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { useEffect, useRef, useMemo } from "react";
import {
  SectionErrorBoundary,
  ComponentErrorBoundary,
} from "./ErrorBoundaries";

interface DiscoverClientProps {
  initialAlbums: Album[];
  initialPagination: {
    hasNext: boolean;
    cursor: string | null;
  } | null;
  initialError: string | null;
  initialTag?: string; // Add optional initialTag prop
}

export function DiscoverClient({
  initialAlbums,
  initialPagination,
  initialError,
  initialTag,
}: DiscoverClientProps) {
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const tag = searchParams.get("tag") || initialTag || undefined;
  const prevTag = useRef<string | undefined>(tag);

  // Use TanStack Query with infinite scroll
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useAlbums({
    isPublic: true,
    limit: 12,
    tag,
  });

  // Flatten all pages into a single albums array
  const albums = useMemo(() => {
    return data?.pages.flatMap((page) => page.albums) || [];
  }, [data]);

  // Create pagination object compatible with existing AlbumGrid component
  const pagination = useMemo(
    () => ({
      hasNext: hasNextPage || false,
      cursor: null, // TanStack Query handles this internally
    }),
    [hasNextPage]
  );

  // Force refetch when tag changes
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

  // Use initial error if no albums were loaded initially and we have an error
  const displayError =
    albums.length === 0 && initialError ? initialError : error?.message || null;

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

        <SectionErrorBoundary context="Album Grid">
          <AlbumGrid
            albums={albums}
            context="discover"
            loadMore={loadMore}
            loading={isLoading || isFetchingNextPage}
            hasMore={pagination?.hasNext || false}
            error={displayError}
          />
        </SectionErrorBoundary>
      </div>
    </SectionErrorBoundary>
  );
}
