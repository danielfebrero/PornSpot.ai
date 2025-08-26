import { useInfiniteQuery } from "@tanstack/react-query";
import { discoverApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  Album,
  Media,
  DiscoverContent,
  DiscoverParams,
} from "@/types/shared-types";
import { last } from "lodash";

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
    staleTime: 3 * 60 * 1000,
    // Enable background refetching for discover content
    refetchOnWindowFocus: false,
  });
}
