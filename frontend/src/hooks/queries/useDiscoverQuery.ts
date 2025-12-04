import { useInfiniteQuery } from "@tanstack/react-query";
import { discoverApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  Album,
  Media,
  DiscoverContent,
  DiscoverParams,
} from "@/types/shared-types";

const STALE_TIME_MS = 3 * 60 * 1000;

interface UseDiscoverParams
  extends Omit<DiscoverParams, "cursorAlbums" | "cursorMedia"> {
  // SSG/ISR support
  initialData?: {
    items: (Album | Media)[];
    cursors?: {
      albums: string | null;
      media: string | null;
    };
  };
}

interface UseDiscoverVideosParams {
  limit?: number;
  sort?: string;
  enabled?: boolean;
  initialData?: {
    items: Media[];
    cursors?: {
      albums: string | null;
      media: string | null;
    };
  };
}

// Hook for fetching mixed content (albums and media) with infinite scroll support
export function useDiscover(params: UseDiscoverParams = {}) {
  const { limit = 20, initialData, ...restParams } = params;

  // Transform initial data for TanStack Query if provided
  const transformedInitialData = initialData
    ? {
        pages: [
          {
            items: initialData.items,
            cursors: initialData.cursors || { albums: null, media: null },
            metadata: {
              totalItems: initialData.items.length,
              albumCount: 0,
              mediaCount: 0,
              diversificationApplied: true,
              timeWindow: "0-7 days ago",
            },
          },
        ],
        pageParams: [{ albums: null, media: null }],
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.discover.list(restParams), // Exclude initialData from query key
    queryFn: async ({ pageParam }): Promise<DiscoverContent> => {
      return await discoverApi.getDiscover({
        ...restParams,
        limit,
        cursorAlbums: pageParam?.albums || undefined,
        cursorMedia: pageParam?.media || undefined,
      });
    },
    initialPageParam: { albums: null, media: null } as {
      albums: string | null;
      media: string | null;
    },
    // Use initial data from SSG/ISR if provided
    initialData: transformedInitialData,
    // Avoid refetching while the user stays on the page; only refresh on mount if stale
    refetchOnMount: (query) => {
      const lastUpdatedAt = query.state.dataUpdatedAt ?? 0;

      if (!lastUpdatedAt) {
        return true;
      }

      return Date.now() - lastUpdatedAt > STALE_TIME_MS;
    },
    refetchOnReconnect: false,
    getNextPageParam: (lastPage: DiscoverContent) => {
      // Always return cursors for next page since hasNext is always true by default
      // The backend will handle when to stop returning items
      return lastPage.cursors.albums || lastPage.cursors.media
        ? {
            albums: lastPage.cursors.albums,
            media: lastPage.cursors.media,
          }
        : undefined;
    },
    getPreviousPageParam: () => undefined, // We don't support backward pagination
    // Fresh data for 3 minutes, then stale-while-revalidate
    staleTime: STALE_TIME_MS,
    // Enable background refetching for discover content
    refetchOnWindowFocus: false,
  });
}

// Hook for fetching videos only with infinite scroll support
export function useDiscoverVideos(params: UseDiscoverVideosParams = {}) {
  const { limit = 10, sort, enabled = true, initialData } = params;

  // Transform initial data for TanStack Query if provided
  const transformedInitialData = initialData
    ? {
        pages: [
          {
            items: initialData.items,
            cursors: initialData.cursors || { albums: null, media: null },
            metadata: {
              totalItems: initialData.items.length,
              albumCount: 0,
              mediaCount: initialData.items.length,
              diversificationApplied: true,
              timeWindow: "video-recent",
            },
          },
        ],
        pageParams: [{ albums: null, media: null }],
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.discover.videos({ limit, sort }),
    queryFn: async ({ pageParam }): Promise<DiscoverContent> => {
      return await discoverApi.getDiscover({
        limit,
        sort,
        mediaType: "video",
        cursorMedia: pageParam?.media || undefined,
      });
    },
    initialPageParam: { albums: null, media: null } as {
      albums: string | null;
      media: string | null;
    },
    initialData: transformedInitialData,
    enabled,
    refetchOnMount: (query) => {
      const lastUpdatedAt = query.state.dataUpdatedAt ?? 0;
      if (!lastUpdatedAt) return true;
      return Date.now() - lastUpdatedAt > STALE_TIME_MS;
    },
    refetchOnReconnect: false,
    getNextPageParam: (lastPage: DiscoverContent) => {
      // For video-only queries, only media cursor is used
      return lastPage.cursors.media
        ? { albums: null, media: lastPage.cursors.media }
        : undefined;
    },
    getPreviousPageParam: () => undefined,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
