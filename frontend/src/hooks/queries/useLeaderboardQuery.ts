import { InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { leaderboardApi } from "@/lib/api/leaderboard";
import { queryKeys } from "@/lib/queryClient";
import type {
  LeaderboardUserEntry,
  GetPSCLeaderboardRequest,
} from "@/types/shared-types";
import { UnifiedLeaderboardResponse } from "@/types";

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes - leaderboard changes less frequently

interface UseLeaderboardParams
  extends Omit<GetPSCLeaderboardRequest, "cursor"> {
  // SSG/ISR support - not commonly used for leaderboard but included for consistency
  initialData?: UnifiedLeaderboardResponse;
}

/**
 * Hook for fetching PSC leaderboard with infinite scroll support
 * Follows established patterns from useAlbums and useDiscover
 */
export function useLeaderboard(params: UseLeaderboardParams = {}) {
  const { limit = 50, initialData, ...restParams } = params;

  // Transform initial data for TanStack Query if provided
  const transformedInitialData = initialData
    ? {
        pages: [initialData],
        pageParams: [undefined as string | undefined],
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.leaderboard.psc(restParams),
    queryFn: async ({ pageParam }) => {
      return await leaderboardApi.getPSCLeaderboard({
        ...restParams,
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    // Use initial data from SSG/ISR if provided
    initialData: transformedInitialData,
    getNextPageParam: (lastPage: UnifiedLeaderboardResponse) => {
      const pagination = lastPage.pagination;
      return pagination?.hasNext ? pagination.cursor : undefined;
    },
    getPreviousPageParam: () => undefined, // We don't support backward pagination
    // Avoid refetching while the user stays on the page
    refetchOnMount: (query) => {
      const lastUpdatedAt = query.state.dataUpdatedAt ?? 0;

      if (!lastUpdatedAt) {
        return true;
      }

      return Date.now() - lastUpdatedAt > STALE_TIME_MS;
    },
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Get all leaderboard users from all pages
 * Useful for accessing the complete flattened list
 * Recalculates ranks to ensure continuous ranking across pages
 */
export function getAllLeaderboardUsers(
  data: InfiniteData<UnifiedLeaderboardResponse, unknown> | undefined
): LeaderboardUserEntry[] {
  if (!data?.pages) return [];

  const allUsers = data.pages.flatMap((page) => page.users || []);

  // Recalculate ranks based on position in complete list
  return allUsers.map((user, index) => ({
    ...user,
    rank: index + 1,
  }));
}
