import { useInfiniteQuery } from "@tanstack/react-query";
import { adminMediaApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { Media, UnifiedPaginationMeta } from "@/types";

interface AdminMediaResponse {
  media: Media[];
  pagination: UnifiedPaginationMeta;
}

// Hook for fetching all media with infinite scroll (admin view)
export function useAdminMediaQuery(params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: ["admin", "media", "all"], // Using temporary key
    queryFn: async ({ pageParam }): Promise<AdminMediaResponse> => {
      return await adminMediaApi.getMediaList({
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    // Keep admin media fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for admin data
    refetchOnWindowFocus: true,
  });
}

// Helper function to extract all media from infinite query
export function useAdminMediaData(params: { limit?: number } = {}) {
  const query = useAdminMediaQuery(params);

  const media = query.data?.pages.flatMap((page) => page.media) ?? [];

  return {
    media,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}
