import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { interactionApi } from "@/lib/api";
import {
  queryKeys,
  queryClient,
  updateCache,
  invalidateQueries,
} from "@/lib/queryClient";
import {
  InteractionRequest,
  UnifiedUserInteractionsResponse,
  UnifiedCommentsResponse,
} from "@/types/user";
import {
  InteractionStatus,
  InteractionTarget,
  InteractionStatusResponse,
} from "@/types";
import { usePrefetchContext } from "@/contexts/PrefetchContext";
import { useUserContext } from "@/contexts/UserContext";

// Hook for fetching user interaction status (like/bookmark status for items)
export function useInteractionStatus(
  targets: InteractionTarget[],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const userContext = useUserContext();
  const targetsKey =
    targets.length === 1
      ? getTargetKey(targets[0])
      : targets.map(getTargetKey).sort().join(",");
  const { isPrefetching, waitForPrefetch } = usePrefetchContext();
  const isCurrentlyPrefetching = isPrefetching(targetsKey);

  // Only fetch interactions if user is logged in
  const isUserLoggedIn = !!userContext.user && !userContext.initializing;

  return useQuery<InteractionStatusResponse>({
    queryKey: queryKeys.user.interactions.status(targets),
    queryFn: async () => {
      if (targets.length === 0) {
        return { statuses: [] };
      }

      // If prefetching is in progress, wait for it to complete
      if (isCurrentlyPrefetching) {
        await waitForPrefetch(targetsKey);

        // Check if data is now available in cache
        const cachedData = queryClient.getQueryData(
          queryKeys.user.interactions.status(targets)
        ) as any;

        if (cachedData) {
          return cachedData;
        }
      }

      return await interactionApi.getInteractionStatus(targets);
    },
    enabled: enabled && targets.length > 0 && isUserLoggedIn,
    // Keep interaction status fresh for 30 seconds
    staleTime: 30 * 1000,
    // Don't refetch on window focus (not critical for UX)
    refetchOnWindowFocus: false,
    // If prefetching, prefer cached data
    refetchOnMount: !isCurrentlyPrefetching,
  });
}

// Hook for reading interaction status from cache only (for buttons)
export function useInteractionStatusFromCache(targets: InteractionTarget[]) {
  const userContext = useUserContext();
  const isUserLoggedIn = !!userContext.user && !userContext.initializing;

  return useQuery<InteractionStatusResponse>({
    queryKey: queryKeys.user.interactions.status(targets),
    queryFn: async () => {
      // This should never be called since enabled is false, but just in case
      return { statuses: [] };
    },
    enabled: false, // Never fetch - only read from cache
    // Return cached data immediately if available
    initialData: () => {
      if (!isUserLoggedIn || targets.length === 0) return undefined;

      const cached = queryClient.getQueryData(
        queryKeys.user.interactions.status(targets)
      ) as InteractionStatusResponse | undefined;

      return cached;
    },
    staleTime: Infinity, // Cache data never goes stale since we don't refetch
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// Hook for fetching user's bookmarks with infinite scroll - UPDATED for unified pagination
export function useBookmarks(params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.bookmarks(params),
    queryFn: async ({ pageParam }) => {
      return await interactionApi.getBookmarks(limit, pageParam);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UnifiedUserInteractionsResponse) => {
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    // Keep bookmarks fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for bookmarks
    refetchOnWindowFocus: true,
  });
}

// Hook for fetching user's likes with infinite scroll - UPDATED for unified pagination
export function useLikes(targetUser?: string, params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.likes({ ...params }),
    queryFn: async ({ pageParam }) => {
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
    getNextPageParam: (lastPage: UnifiedUserInteractionsResponse) => {
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: !!targetUser || true, // Always enabled for own likes, enabled only if targetUser provided for others
    // Keep likes fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for likes
    refetchOnWindowFocus: true,
  });
}

// Hook for fetching user's comments with infinite scroll - UPDATED for unified pagination
export function useComments(username: string, params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.comments({ username, ...params }),
    queryFn: async ({ pageParam }) => {
      return await interactionApi.getCommentsByUsername(
        username,
        limit,
        pageParam
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UnifiedCommentsResponse) => {
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: !!username,
    // Keep comments fresh for 1 minute
    staleTime: 60 * 1000,
  });
}

// Hook for fetching target-specific comments (album/media comments)
export function useTargetComments(
  targetType: "album" | "media",
  targetId: string,
  params: { limit?: number } = {}
) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.comments.byTarget(targetType, targetId),
    queryFn: async ({ pageParam }) => {
      return await interactionApi.getComments(
        targetType,
        targetId,
        limit,
        pageParam
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UnifiedCommentsResponse) => {
      // Check if using cursor-based or page-based pagination based on response
      if (lastPage.pagination?.hasNext) {
        // If it's actually using cursor-based (as suggested by the cursor param)
        // we need to return a cursor, but CommentListResponse doesn't have it
        // For now, return undefined to disable infinite scrolling until fixed
        return undefined;
      }
      return undefined;
    },
    enabled: !!targetType && !!targetId,
    // Keep comments fresh for 1 minute
    staleTime: 60 * 1000,
  });
}

// Mutation for toggling like status
export function useToggleLike() {
  return useMutation({
    mutationFn: async ({
      targetType,
      targetId,
      albumId,
      isCurrentlyLiked,
    }: {
      targetType: "album" | "media" | "comment";
      targetId: string;
      albumId?: string;
      isCurrentlyLiked: boolean;
      allTargets?: InteractionTarget[]; // All targets in the current context (for comments)
    }) => {
      const request: InteractionRequest = {
        action: isCurrentlyLiked ? "remove" : "add",
        targetType,
        targetId,
      };

      // Add albumId for media interactions only if provided
      if (targetType === "media" && albumId) {
        request.albumId = albumId;
      }

      return await interactionApi.like(request);
    },
    onMutate: async ({
      targetType,
      targetId,
      isCurrentlyLiked,
      allTargets,
    }) => {
      // For comments, use the complete targets array if provided
      // For albums/media, use single target
      const targets =
        allTargets && allTargets.length > 0
          ? allTargets
          : [{ targetType, targetId }];

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.user.interactions.status(targets),
      });

      // Store the previous data for rollback on error
      const previousData = queryClient.getQueryData(
        queryKeys.user.interactions.status(targets)
      );

      // Optimistically update interaction status - this will handle both status and count updates
      const newLikedState = !isCurrentlyLiked;
      const countIncrement = isCurrentlyLiked ? -1 : 1;

      // Update the interaction status cache with both status and count
      queryClient.setQueryData(
        queryKeys.user.interactions.status(targets),
        (oldData: InteractionStatusResponse | undefined) => {
          // If there's no existing data, create the structure with the optimistic update
          if (!oldData?.statuses) {
            return {
              success: true,
              statuses: [
                {
                  targetType,
                  targetId,
                  userLiked: newLikedState,
                  userBookmarked: false,
                  likeCount: newLikedState ? 1 : 0,
                  bookmarkCount: 0,
                },
              ],
            };
          }

          // Check if the target already exists in the statuses
          const existingStatusIndex = oldData.statuses.findIndex(
            (status) =>
              status.targetType === targetType && status.targetId === targetId
          );

          if (existingStatusIndex >= 0) {
            // Update existing status
            const updatedStatuses = [...oldData.statuses];
            updatedStatuses[existingStatusIndex] = {
              ...updatedStatuses[existingStatusIndex],
              userLiked: newLikedState,
              likeCount: Math.max(
                0,
                (updatedStatuses[existingStatusIndex].likeCount || 0) +
                  countIncrement
              ),
            };

            return {
              ...oldData,
              statuses: updatedStatuses,
            };
          } else {
            // Add new status if it doesn't exist
            return {
              ...oldData,
              statuses: [
                ...oldData.statuses,
                {
                  targetType,
                  targetId,
                  userLiked: newLikedState,
                  userBookmarked: false,
                  likeCount: Math.max(0, countIncrement),
                  bookmarkCount: 0,
                },
              ],
            };
          }
        }
      );

      // Also update counts in other caches (album/media detail pages, album lists)
      updateCache.interactionCounts(
        targetType,
        targetId,
        "like",
        countIncrement
      );

      return {
        targetType,
        targetId,
        isCurrentlyLiked,
        previousData,
        allTargets,
      };
    },
    onError: (error, variables, context) => {
      console.error("Failed to toggle like:", error);

      if (context) {
        // Use the same targets as in onMutate
        const targets =
          context.allTargets && context.allTargets.length > 0
            ? context.allTargets
            : [{ targetType: context.targetType, targetId: context.targetId }];

        // Restore the previous data if we have it
        if (context.previousData !== undefined) {
          queryClient.setQueryData(
            queryKeys.user.interactions.status(targets),
            context.previousData
          );
        } else {
          // Fallback: revert optimistic updates manually
          updateCache.userInteractionStatus(
            context.targetType,
            context.targetId,
            {
              userLiked: context.isCurrentlyLiked,
            }
          );

          updateCache.interactionCounts(
            context.targetType,
            context.targetId,
            "like",
            context.isCurrentlyLiked ? 1 : -1
          );
        }
      }

      // Invalidate to refetch correct data
      invalidateQueries.userInteractions();
    },
    onSuccess: () => {
      // For likes, we don't invalidate the interaction status cache
      // because we want to keep the optimistic update in place
      // The API doesn't return the updated counts, so invalidating would cause a refetch
      // which defeats the purpose of optimistic updates

      // Only invalidate the user's likes list (to update the "My Likes" page)
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.interactions.likes(),
      });

      // Also invalidate insights to update received likes count
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.interactions.insights(),
      });

      // Invalidate useLikesQuery hook to update the list of received likes
      // This covers both own likes and other users' likes queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          // Match any query that starts with ["user", "interactions", "likes"]
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "user" &&
            queryKey[1] === "interactions" &&
            queryKey[2] === "likes"
          );
        },
      });
    },
  });
}

// Mutation for toggling bookmark status
export function useToggleBookmark() {
  return useMutation({
    mutationFn: async ({
      targetType,
      targetId,
      albumId,
      isCurrentlyBookmarked,
    }: {
      targetType: "album" | "media";
      targetId: string;
      albumId?: string;
      isCurrentlyBookmarked: boolean;
    }) => {
      const request: InteractionRequest = {
        action: isCurrentlyBookmarked ? "remove" : "add",
        targetType,
        targetId,
      };

      // Add albumId for media interactions only if provided
      if (targetType === "media" && albumId) {
        request.albumId = albumId;
      }

      return await interactionApi.bookmark(request);
    },
    onMutate: async ({ targetType, targetId, isCurrentlyBookmarked }) => {
      // Cancel outgoing refetches
      const targets = [{ targetType, targetId }];
      await queryClient.cancelQueries({
        queryKey: queryKeys.user.interactions.status(targets),
      });

      // Store the previous data for rollback on error
      const previousData = queryClient.getQueryData(
        queryKeys.user.interactions.status(targets)
      );

      // Optimistically update interaction status - this will handle both status and count updates
      const newBookmarkedState = !isCurrentlyBookmarked;
      const countIncrement = isCurrentlyBookmarked ? -1 : 1;

      // Update the interaction status cache with both status and count
      queryClient.setQueryData(
        queryKeys.user.interactions.status(targets),
        (oldData: InteractionStatusResponse | undefined) => {
          // If there's no existing data, create the structure with the optimistic update
          if (!oldData?.statuses) {
            return {
              statuses: [
                {
                  targetType,
                  targetId,
                  userLiked: false,
                  userBookmarked: newBookmarkedState,
                  likeCount: 0,
                  bookmarkCount: newBookmarkedState ? 1 : 0,
                },
              ],
            };
          }

          return {
            ...oldData,
            statuses: oldData.statuses.map((status) => {
              if (
                status.targetType === targetType &&
                status.targetId === targetId
              ) {
                return {
                  ...status,
                  userBookmarked: newBookmarkedState,
                  bookmarkCount: Math.max(
                    0,
                    (status.bookmarkCount || 0) + countIncrement
                  ),
                };
              }
              return status;
            }),
          };
        }
      );

      // Also update counts in other caches (album/media detail pages, album lists)
      updateCache.interactionCounts(
        targetType,
        targetId,
        "bookmark",
        countIncrement
      );

      return { targetType, targetId, isCurrentlyBookmarked, previousData };
    },
    onError: (error, variables, context) => {
      console.error("Failed to toggle bookmark:", error);

      if (context) {
        const targets = [
          { targetType: context.targetType, targetId: context.targetId },
        ];

        // Restore the previous data if we have it
        if (context.previousData !== undefined) {
          queryClient.setQueryData(
            queryKeys.user.interactions.status(targets),
            context.previousData
          );
        } else {
          // Fallback: revert optimistic updates manually
          updateCache.userInteractionStatus(
            context.targetType,
            context.targetId,
            {
              userBookmarked: context.isCurrentlyBookmarked,
            }
          );

          updateCache.interactionCounts(
            context.targetType,
            context.targetId,
            "bookmark",
            context.isCurrentlyBookmarked ? 1 : -1
          );
        }
      }

      // Invalidate to refetch correct data
      invalidateQueries.userInteractions();
    },
    onSuccess: (data, { targetType, targetId }) => {
      // Invalidate related queries to ensure consistency
      const targets = [{ targetType, targetId }];
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.interactions.status(targets),
      });

      // Invalidate bookmarks list
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.interactions.bookmarks(),
      });

      // Invalidate insights to update received bookmarks count
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.interactions.insights(),
      });

      // Invalidate all bookmark-related queries to update received bookmarks
      // This covers both own bookmarks and other users' bookmark queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          // Match any query that starts with ["user", "interactions", "bookmarks"]
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === "user" &&
            queryKey[1] === "interactions" &&
            queryKey[2] === "bookmarks"
          );
        },
      });
    },
  });
}

// Helper to create a unique key for a single target
function getTargetKey(target: InteractionTarget): string {
  return `${target.targetType}:${target.targetId}`;
}

// Utility hook for preloading interaction statuses
export function usePrefetchInteractionStatus() {
  const { isPrefetching, startPrefetch, endPrefetch } = usePrefetchContext();
  const userContext = useUserContext();
  const isUserLoggedIn = !!userContext.user && !userContext.initializing;

  return {
    prefetch: async (targets: InteractionTarget[]) => {
      if (targets.length === 0 || !isUserLoggedIn) return;

      // Create individual keys for each target so individual queries can detect them
      const individualKeys = targets.map(getTargetKey);

      // Filter out targets that are already being prefetched
      const targetsNotPrefetching = targets.filter((target, index) => {
        const individualKey = individualKeys[index];
        return !isPrefetching(individualKey);
      });

      // If all targets are already being prefetched, skip
      if (targetsNotPrefetching.length === 0) {
        return;
      }

      // Only prefetch the targets that aren't already being prefetched
      const keysToPrefetch = targetsNotPrefetching.map(getTargetKey);

      // Create the prefetch promise
      const prefetchPromise = queryClient.prefetchQuery({
        queryKey: queryKeys.user.interactions.status(targetsNotPrefetching),
        queryFn: async () => {
          // Check if any individual targets already have cached data
          const cachedStatuses: InteractionStatus[] = [];
          const targetsNeedingFetch: InteractionTarget[] = [];

          targetsNotPrefetching.forEach((target) => {
            const singleTarget = [target];
            const cachedData = queryClient.getQueryData(
              queryKeys.user.interactions.status(singleTarget)
            ) as InteractionStatusResponse | undefined;

            if (cachedData?.statuses?.[0]) {
              // Use cached data for this target
              cachedStatuses.push(cachedData.statuses[0]);
            } else {
              // Need to fetch this target
              targetsNeedingFetch.push(target);
            }
          });

          let fetchedStatuses: InteractionStatus[] = [];

          // Only make API call if there are targets that need fetching
          if (targetsNeedingFetch.length > 0) {
            const result = await interactionApi.getInteractionStatus(
              targetsNeedingFetch
            );

            if (result?.statuses) {
              fetchedStatuses = result.statuses;

              // Populate individual query caches from bulk response
              fetchedStatuses.forEach((status) => {
                const singleTarget = [
                  {
                    targetType: status.targetType,
                    targetId: status.targetId,
                  },
                ];

                queryClient.setQueryData(
                  queryKeys.user.interactions.status(singleTarget),
                  {
                    statuses: [status],
                  }
                );
              });
            }
          }

          // Combine cached and fetched statuses
          const allStatuses = [...cachedStatuses, ...fetchedStatuses];

          return {
            statuses: allStatuses,
          };
        },
        staleTime: 30 * 1000, // 30 seconds
      });

      // Mark individual keys as prefetching with the shared promise
      startPrefetch(keysToPrefetch, prefetchPromise);

      try {
        await prefetchPromise;
      } finally {
        // Remove from prefetching set when done
        endPrefetch(keysToPrefetch);
      }
    },

    // Helper to check if targets are currently being prefetched
    isPrefetching: (targets: InteractionTarget[]) => {
      const targetKey =
        targets.length === 1
          ? getTargetKey(targets[0])
          : targets.map(getTargetKey).sort().join(",");
      return isPrefetching(targetKey);
    },
  };
}

// Convenience hook for automatically prefetching targets with proper async handling
// Uses useLayoutEffect for earliest possible execution, especially important for SSG pages
export function useAutoPrefetchInteractionStatus(targets: InteractionTarget[]) {
  const { prefetch } = usePrefetchInteractionStatus();

  useLayoutEffect(() => {
    if (targets.length > 0) {
      const prefetchData = async () => {
        try {
          await prefetch(targets);
        } catch (error) {
          console.error("Failed to prefetch interaction status:", error);
        }
      };

      prefetchData();
    }
  }, [targets, prefetch]);
}
