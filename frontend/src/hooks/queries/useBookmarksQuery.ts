import { useInfiniteQuery } from "@tanstack/react-query";
import { interactionApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { UnifiedUserInteractionsResponse } from "@/types/user";

// Types
interface BookmarksQueryParams {
  limit?: number;
  includeContentPreview?: boolean; // New parameter for content preview
}

// Use the new unified response type
type BookmarksResponse = UnifiedUserInteractionsResponse;

// Hook for fetching user's bookmarks with infinite scroll
export function useBookmarksQuery(params: BookmarksQueryParams = {}) {
  const { limit = 20, includeContentPreview } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.bookmarks(params),
    queryFn: async ({ pageParam }): Promise<BookmarksResponse> => {
      return await interactionApi.getBookmarks({
        limit,
        cursor: pageParam,
        includeContentPreview,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: BookmarksResponse) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    // Keep bookmarks fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for bookmarks
    refetchOnWindowFocus: true,
  });
}
