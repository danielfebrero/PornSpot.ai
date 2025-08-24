import { useInfiniteQuery } from "@tanstack/react-query";
import { discoverApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { Album, Media } from "@/types";
import { DiscoverResponse, DiscoverParams } from "@/lib/api/discover";

interface UseDiscoverParams extends Omit<DiscoverParams, "cursor"> {
  // SSG/ISR support
  initialData?: {
    items: (Album | Media)[];
    pagination?: {
      hasNext: boolean;
      cursor: string | null;
    };
  };
}

// Hook for fetching mixed content (albums and media) with infinite scroll support
export function useDiscover(params: UseDiscoverParams = {}) {
  const { limit = 12, initialData, ...restParams } = params;

  // Transform initial data for TanStack Query if provided
  const transformedInitialData = initialData
    ? {
        pages: [
          {
            items: initialData.items,
            pagination: {
              hasNext: initialData.pagination?.hasNext || false,
              cursor: initialData.pagination?.cursor || null,
              limit: limit,
            },
          },
        ],
        pageParams: [undefined as string | undefined],
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.discover.list(restParams), // Exclude initialData from query key
    queryFn: async ({ pageParam }): Promise<DiscoverResponse> => {
      return await discoverApi.getDiscover({
        ...restParams,
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    // Use initial data from SSG/ISR if provided
    initialData: transformedInitialData,
    getNextPageParam: (lastPage: DiscoverResponse) => {
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    getPreviousPageParam: () => undefined, // We don't support backward pagination
    // Fresh data for 30 seconds, then stale-while-revalidate
    staleTime: 30 * 1000,
    // Enable background refetching for public content
    refetchOnWindowFocus: restParams.isPublic === true,
    // Refetch interval for public content discovery
    refetchInterval: restParams.isPublic === true ? 3 * 60 * 1000 : false, // 3 minutes
  });
}
