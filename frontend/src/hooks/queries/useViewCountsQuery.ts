import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { contentApi, interactionApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import type { Album, Media } from "@/types";

// Types
interface ViewCountTarget {
  targetType: "album" | "media";
  targetId: string;
}

interface ViewCountItem {
  targetType: "album" | "media";
  targetId: string;
  viewCount: number;
}

interface ViewCountResponse {
  viewCounts: ViewCountItem[];
}

// Cache data structures
interface AlbumsListData {
  albums: Album[];
  pagination?: unknown;
}

type DetailData = (Album | Media) & {
  viewCount?: number;
};

// Hook for fetching view counts for multiple targets (bulk fetch)
export function useViewCounts(
  targets: ViewCountTarget[],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery<ViewCountResponse>({
    queryKey: queryKeys.content.viewCounts(targets),
    queryFn: async () => {
      if (targets.length === 0) {
        return { viewCounts: [] };
      }

      return await contentApi.getViewCounts(targets);
    },
    enabled: enabled && targets.length > 0,
    // Keep view counts fresh for 5 minutes (they don't change as frequently as interactions)
    staleTime: 5 * 60 * 1000,
    // Don't refetch on window focus (not critical for UX and data doesn't change frequently)
    refetchOnWindowFocus: false,
  });
}

// Hook for reading view counts from cache only (for components that don't want to trigger fetches)
export function useViewCountsFromCache(targets: ViewCountTarget[]) {
  const result = useViewCounts(targets, { enabled: false });

  // Force re-render when cache data changes, even with enabled: false
  // This ensures ViewCount components update when view tracking occurs
  return result;
}

// Hook for fetching view count for a single target
export function useViewCount(
  targetType: "album" | "media",
  targetId: string,
  options: { enabled?: boolean } = {}
) {
  const targets = [{ targetType, targetId }];
  const { data, ...rest } = useViewCounts(targets, options);

  const viewCount = data?.viewCounts?.[0]?.viewCount ?? 0;

  return {
    data: viewCount,
    ...rest,
  };
}

// Hook for bulk fetching view counts for components with many items
// Automatically batches targets into reasonable chunks to avoid API limits
export function useBulkViewCounts(
  targets: ViewCountTarget[],
  options: { enabled?: boolean; chunkSize?: number } = {}
) {
  const { enabled = true, chunkSize = 50 } = options;

  // Split targets into chunks to avoid API limits
  const chunks = [];
  for (let i = 0; i < targets.length; i += chunkSize) {
    chunks.push(targets.slice(i, i + chunkSize));
  }

  // Use useQueries to fetch each chunk in parallel
  const queries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: queryKeys.content.viewCounts(chunk),
      queryFn: async () => {
        if (chunk.length === 0) {
          return { viewCounts: [] };
        }
        return await contentApi.getViewCounts(chunk);
      },
      enabled: enabled && chunk.length > 0,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  // Combine results from all chunks
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const error = queries.find((query) => query.error)?.error;

  const viewCounts = queries
    .filter((query) => query.data)
    .flatMap((query) => query.data!.viewCounts);

  // Update individual target caches with the bulk-fetched data
  // This ensures that individual useViewCount hooks can benefit from bulk fetching
  viewCounts.forEach((item) => {
    const singleTarget = [
      { targetType: item.targetType, targetId: item.targetId },
    ];
    const singleTargetQueryKey = queryKeys.content.viewCounts(singleTarget);

    // Set cache data for individual targets
    queryClient.setQueryData(singleTargetQueryKey, {
      viewCounts: [item],
    });
  });

  // Create a map for easy lookup
  const viewCountMap = new Map<string, number>();
  viewCounts.forEach((item) => {
    const key = `${item.targetType}:${item.targetId}`;
    viewCountMap.set(key, item.viewCount);
  });

  return {
    viewCounts,
    viewCountMap,
    isLoading,
    isError,
    error,
    // Helper function to get view count for a specific target
    getViewCount: (targetType: "album" | "media", targetId: string) => {
      const key = `${targetType}:${targetId}`;
      return viewCountMap.get(key) ?? 0;
    },
  };
}

// Hook for tracking a view - updates cache optimistically
export function useTrackView() {
  return useMutation({
    mutationFn: async (request: {
      targetType: "album" | "media" | "profile";
      targetId: string;
    }) => {
      return await interactionApi.trackView(request);
    },
    onMutate: async ({ targetType, targetId }) => {
      // Only update view counts for album and media (profile views are not cached)
      if (targetType === "profile") {
        return;
      }

      // Cancel outgoing refetches for view count queries
      const targets = [
        { targetType: targetType as "album" | "media", targetId },
      ];
      await queryClient.cancelQueries({
        queryKey: queryKeys.content.viewCounts(targets),
      });

      // Store previous data for potential rollback
      const previousData = queryClient.getQueryData(
        queryKeys.content.viewCounts(targets)
      );

      // Optimistically increment the view count
      queryClient.setQueryData(
        queryKeys.content.viewCounts(targets),
        (oldData: ViewCountResponse | undefined) => {
          // If no existing data, create initial structure
          if (!oldData?.viewCounts) {
            return {
              viewCounts: [
                {
                  targetType,
                  targetId,
                  viewCount: 1,
                },
              ],
            };
          }

          return {
            ...oldData,

            viewCounts: oldData.viewCounts.map((item: ViewCountItem) => {
              if (
                item.targetType === targetType &&
                item.targetId === targetId
              ) {
                return {
                  ...item,
                  viewCount: (item.viewCount || 0) + 1,
                };
              }
              return item;
            }),
          };
        }
      );

      // Force update all possible cache entries for this target
      // This ensures ViewCount components update even if they started with no data
      queryClient.setQueriesData(
        { queryKey: queryKeys.content.viewCounts },
        (oldData: ViewCountResponse | undefined) => {
          if (!oldData?.viewCounts) {
            // Create cache entry for this specific target
            return {
              viewCounts: [
                {
                  targetType,
                  targetId,
                  viewCount: 1,
                },
              ],
            };
          }

          // Update existing cache entries
          return {
            ...oldData,
            viewCounts: oldData.viewCounts.map((item: ViewCountItem) => {
              if (
                item.targetType === targetType &&
                item.targetId === targetId
              ) {
                return {
                  ...item,
                  viewCount: (item.viewCount || 0) + 1,
                };
              }
              return item;
            }),
          };
        }
      );

      // Also update view count in detail pages and lists
      updateViewCountInCaches(targetType as "album" | "media", targetId, 1);

      return { targetType, targetId, previousData };
    },
    onError: (error, variables, context) => {
      // View tracking failure is not critical - just log it
      console.debug("View tracking failed:", error);

      // Rollback optimistic update if we have context and it's not a profile view
      if (context && variables.targetType !== "profile") {
        const targets = [
          {
            targetType: variables.targetType as "album" | "media",
            targetId: context.targetId,
          },
        ];

        if (context.previousData) {
          queryClient.setQueryData(
            queryKeys.content.viewCounts(targets),
            context.previousData
          );
        } else {
          // Fallback: decrement the optimistic increment
          updateViewCountInCaches(
            variables.targetType as "album" | "media",
            context.targetId,
            -1
          );
        }
      }
    },
    onSuccess: (data, variables) => {
      // On success, we could invalidate to get exact server count,
      // but for view counts this isn't critical since they're just indicators
      // The optimistic update is likely accurate enough

      // For profile views, no cache update needed since we don't cache profile view counts
      if (variables.targetType === "profile") {
        return;
      }

      // Optionally: invalidate view count queries to get exact server count
      // Commented out to avoid unnecessary refetches since view counts are not critical
      // const targets = [{ targetType: variables.targetType as "album" | "media", targetId: variables.targetId }];
      // queryClient.invalidateQueries({
      //   queryKey: queryKeys.content.viewCounts(targets),
      // });
    },
  });
}

// Helper function to update view counts in various caches
function updateViewCountInCaches(
  targetType: "album" | "media",
  targetId: string,
  increment: number
) {
  // Update in album/media detail pages
  const detailQueryKey =
    targetType === "album"
      ? queryKeys.albums.detail(targetId)
      : queryKeys.media.detail(targetId);

  queryClient.setQueryData(detailQueryKey, (oldData: DetailData | undefined) => {
    if (!oldData) return oldData;

    return {
      ...oldData,
      viewCount: Math.max(0, (oldData.viewCount || 0) + increment),
    };
  });

  // Update in album lists (for albums)
  if (targetType === "album") {
    queryClient.setQueriesData(
      { queryKey: queryKeys.albums.lists() },
      (oldData: AlbumsListData | undefined) => {
        if (!oldData?.albums) return oldData;

        return {
          ...oldData,
          albums: oldData.albums.map((album) => {
            if (album.id === targetId) {
              return {
                ...album,
                viewCount: Math.max(0, (album.viewCount || 0) + increment),
              };
            }
            return album;
          }),
        };
      }
    );
  }

  // Update in bulk view counts caches
  queryClient.setQueriesData(
    { queryKey: queryKeys.content.viewCounts },

    (oldData: ViewCountResponse | undefined) => {
      if (!oldData?.viewCounts) return oldData;

      return {
        ...oldData,
        viewCounts: oldData.viewCounts.map((item: ViewCountItem) => {
          if (item.targetType === targetType && item.targetId === targetId) {
            return {
              ...item,
              viewCount: Math.max(0, (item.viewCount || 0) + increment),
            };
          }
          return item;
        }),
      };
    }
  );
}
