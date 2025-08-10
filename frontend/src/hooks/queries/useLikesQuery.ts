import { useInfiniteQuery } from "@tanstack/react-query";
import { interactionApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { UnifiedUserInteractionsResponse } from "@/types/user";

// Types
interface LikesQueryParams {
  targetUser?: string;
  limit?: number;
}

// Use the new unified response type
type LikesResponse = UnifiedUserInteractionsResponse;

// Hook for fetching user's likes with infinite scroll
export function useLikesQuery(params: LikesQueryParams = {}) {
  const { targetUser, limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.likes(params),
    queryFn: async ({ pageParam }): Promise<LikesResponse> => {
      if (targetUser) {
        return await interactionApi.getLikesByUsername(
          targetUser,
          limit,
          pageParam
        );
      } else {
        return await interactionApi.getLikes(limit, pageParam);
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: LikesResponse) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: !targetUser || !!targetUser, // Always enabled for own likes, enabled only if targetUser provided for others
    // Keep likes fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for likes
    refetchOnWindowFocus: true,
  });
}
