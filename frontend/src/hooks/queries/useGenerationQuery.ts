/**
 * React Query hooks for generation-related operations
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateApi, UsageStatsResponse } from "@/lib/api/generate";
import { queryKeys } from "@/lib/queryClient";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { Media } from "@/types";

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

export function useGetIncompleteI2VJobs() {
  return useQuery({
    queryKey: queryKeys.generation.incompleteI2VJobs(),
    queryFn: generateApi.getIncompleteI2VJobs,
    refetchInterval: 30_000, // periodic refresh safety
    staleTime: 5_000,
  });
}

// Internal helper to inject media into existing infinite queries (user media of type video)
function addMediaToUserVideoQueries(newMedia: Media) {
  queryClient.setQueriesData({ queryKey: ["media", "user"] }, (old: any) => {
    if (!old?.pages) return old;
    // Avoid duplicates
    const already = old.pages.some((p: any) =>
      p.media?.some((m: any) => m.id === newMedia.id)
    );
    if (already) return old;
    // Insert into first page
    const first = old.pages[0];
    const updatedFirst = {
      ...first,
      media: [newMedia, ...(first.media || [])],
    };
    return { ...old, pages: [updatedFirst, ...old.pages.slice(1)] };
  });
}

export function usePollI2VJob(jobId: string | undefined, enable: boolean) {
  return useQuery({
    queryKey: jobId
      ? queryKeys.generation.i2vJob(jobId)
      : ["generation", "i2v", "job", "disabled"],
    queryFn: async () => {
      if (!jobId) return null as any;
      const resp = await generateApi.pollI2VJob(jobId);
      const status = resp ? (resp as any).status : undefined;

      // Optimistic cache modifications if completed
      if (resp && status === "COMPLETED" && (resp as any).media) {
        const media = (resp as any).media as Media;
        addMediaToUserVideoQueries(media);
      }

      if (
        status === "COMPLETED" ||
        status === "FAILED" ||
        status === "CANCELLED"
      ) {
        queryClient.setQueryData(
          queryKeys.generation.incompleteI2VJobs(),
          (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.filter((j: any) => j.jobId !== jobId);
          }
        );
      }
      return resp;
    },
    enabled: !!jobId && enable,
    refetchInterval: 5_000,
  });
}
