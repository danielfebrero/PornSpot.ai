/**
 * React Query hooks for generation-related operations
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateApi, UsageStatsResponse } from "@/lib/api/generate";
import { queryKeys } from "@/lib/queryClient";

/**
 * Hook to get current usage statistics
 */
export function useUsageStats() {
  return useQuery({
    queryKey: queryKeys.generation.usageStats(),
    queryFn: generateApi.getUsageStats,
    staleTime: 1000 * 30, // 30 seconds - keep fresh for real-time quota checks
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

/**
 * Hook to manually refresh usage stats
 */
export function useRefreshUsageStats() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.generation.usageStats(),
    });
  };
}

/**
 * Hook to optimistically decrement usage stats remaining value
 */
export function useDecrementUsageStats() {
  const queryClient = useQueryClient();

  return (batchCount: number = 1) => {
    queryClient.setQueryData<UsageStatsResponse>(
      queryKeys.generation.usageStats(),
      (oldData) => {
        if (!oldData) return oldData;

        // Calculate new remaining count
        let newRemaining: number | "unlimited" = "unlimited";
        if (
          oldData.remaining !== "unlimited" &&
          oldData.remaining !== undefined
        ) {
          newRemaining = Math.max(0, oldData.remaining - batchCount);
        }

        return {
          ...oldData,
          remaining: newRemaining,
          allowed: newRemaining === "unlimited" || newRemaining > 0,
        };
      }
    );
  };
}
