import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { interactionApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import { UnifiedCommentsResponse } from "@/types/user";
import { CreateCommentRequest } from "@/types";

// Types
interface CommentsQueryParams {
  username: string;
  limit?: number;
  includeContentPreview?: boolean; // New parameter for content preview
}

// Hook for fetching user's comments with infinite scroll
export function useCommentsQuery(params: CommentsQueryParams) {
  const { username, limit = 20, includeContentPreview } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.comments({ username, limit }),
    queryFn: async ({ pageParam }): Promise<UnifiedCommentsResponse> => {
      return await interactionApi.getCommentsByUsername({
        username,
        limit,
        cursor: pageParam,
        includeContentPreview,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UnifiedCommentsResponse) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: !!username,
    // Keep comments fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for comments
    refetchOnWindowFocus: true,
  });
}

// Hook for fetching target-specific comments (album/media comments)
export function useTargetComments(
  targetType: "album" | "media",
  targetId: string,
  params: { limit?: number; enabled?: boolean } = {}
) {
  const { limit = 20, enabled = true } = params;

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
      return lastPage?.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: enabled && !!targetType && !!targetId,
    // Keep comments fresh for 1 minute
    staleTime: 60 * 1000,
  });
}

// Comment mutations
export function useCreateComment() {
  return useMutation({
    mutationFn: async (request: CreateCommentRequest) => {
      return await interactionApi.createComment(request);
    },
    onMutate: async (request) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({
        queryKey: queryKeys.comments.byTarget(
          request.targetType,
          request.targetId
        ),
      });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData(
        queryKeys.comments.byTarget(request.targetType, request.targetId)
      );

      // Create optimistic comment
      const optimisticComment = {
        id: `temp-${Date.now()}`, // Temporary ID
        content: request.content,
        authorId: "current-user", // Will be replaced by real data
        authorName: "You", // Placeholder
        targetType: request.targetType,
        targetId: request.targetId,
        createdAt: new Date().toISOString(),
        isEdited: false,
        likeCount: 0,
      };

      // Optimistically update target comments query
      queryClient.setQueryData(
        queryKeys.comments.byTarget(request.targetType, request.targetId),
        (old: any) => {
          if (!old) {
            return {
              pages: [
                {
                  comments: [optimisticComment],
                  pagination: { hasNext: false, cursor: undefined },
                },
              ],
              pageParams: [undefined],
            };
          }

          // Handle infinite query structure
          if (old.pages) {
            const newPages = [...old.pages];
            if (newPages.length > 0) {
              newPages[0] = {
                ...newPages[0],
                comments: [optimisticComment, ...(newPages[0].comments || [])],
              };
            } else {
              newPages.push({
                comments: [optimisticComment],
                pagination: { hasNext: false, cursor: undefined },
              });
            }
            return {
              ...old,
              pages: newPages,
            };
          }

          return old;
        }
      );

      // Return a context object with the snapshotted value
      return { previousData, optimisticComment };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.comments.byTarget(variables.targetType, variables.targetId),
          context.previousData
        );
      }
    },
    onSuccess: (response, variables, context) => {
      // Replace optimistic comment with real data
      if (context?.optimisticComment && response) {
        queryClient.setQueryData(
          queryKeys.comments.byTarget(variables.targetType, variables.targetId),
          (old: any) => {
            if (!old?.pages) return old;

            return {
              ...old,
              pages: old.pages.map((page: any, pageIndex: number) => {
                if (pageIndex === 0) {
                  return {
                    ...page,
                    comments:
                      page.comments?.map((comment: any) =>
                        comment.id === context.optimisticComment.id
                          ? response
                          : comment
                      ) || [],
                  };
                }
                return page;
              }),
            };
          }
        );
      }
    },
    onSettled: (response, error, variables) => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.byTarget(
          variables.targetType,
          variables.targetId
        ),
      });
    },
  });
}

export function useUpdateComment() {
  return useMutation({
    mutationFn: async (params: { commentId: string; content: string }) => {
      return await interactionApi.updateComment(params.commentId, {
        content: params.content,
      });
    },
    onMutate: async ({ commentId, content }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["comments"] });
      await queryClient.cancelQueries({
        queryKey: ["user", "interactions", "comments"],
      });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: ["comments"],
      });
      const previousUserData = queryClient.getQueriesData({
        queryKey: ["user", "interactions", "comments"],
      });

      // Optimistically update all comment queries
      queryClient.setQueriesData({ queryKey: ["comments"] }, (old: any) => {
        if (!old) return old;

        // Handle infinite query structure (for target comments)
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              comments:
                page.comments?.map((comment: any) =>
                  comment.id === commentId
                    ? { ...comment, content, isEdited: true }
                    : comment
                ) || [],
            })),
          };
        }

        // Handle regular query structure (for user comments)
        if (old.comments) {
          return {
            ...old,
            comments: old.comments.map((comment: any) =>
              comment.id === commentId
                ? { ...comment, content, isEdited: true }
                : comment
            ),
          };
        }

        return old;
      });

      // Also update user interactions comments queries
      queryClient.setQueriesData(
        { queryKey: ["user", "interactions", "comments"] },
        (old: any) => {
          if (!old) return old;

          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                comments:
                  page.comments?.map((comment: any) =>
                    comment.id === commentId
                      ? { ...comment, content, isEdited: true }
                      : comment
                  ) || [],
              })),
            };
          }

          return old;
        }
      );

      // Return a context object with the snapshotted value
      return { previousData, previousUserData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUserData) {
        context.previousUserData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["comments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["user", "interactions", "comments"],
      });
    },
  });
}

export function useDeleteComment() {
  return useMutation({
    mutationFn: async (commentId: string) => {
      return await interactionApi.deleteComment(commentId);
    },
    onMutate: async (commentId) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["comments"] });
      await queryClient.cancelQueries({
        queryKey: ["user", "interactions", "comments"],
      });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueriesData({
        queryKey: ["comments"],
      });
      const previousUserData = queryClient.getQueriesData({
        queryKey: ["user", "interactions", "comments"],
      });

      // Optimistically remove the comment from all comment queries
      queryClient.setQueriesData({ queryKey: ["comments"] }, (old: any) => {
        if (!old) return old;

        // Handle infinite query structure (for target comments)
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              comments:
                page.comments?.filter(
                  (comment: any) => comment.id !== commentId
                ) || [],
            })),
          };
        }

        // Handle regular query structure (for user comments)
        if (old.comments) {
          return {
            ...old,
            comments: old.comments.filter(
              (comment: any) => comment.id !== commentId
            ),
          };
        }

        return old;
      });

      // Also remove from user interactions comments queries
      queryClient.setQueriesData(
        { queryKey: ["user", "interactions", "comments"] },
        (old: any) => {
          if (!old) return old;

          if (old.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                comments:
                  page.comments?.filter(
                    (comment: any) => comment.id !== commentId
                  ) || [],
              })),
            };
          }

          return old;
        }
      );

      // Return a context object with the snapshotted value
      return { previousData, previousUserData };
    },
    onError: (err, commentId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousUserData) {
        context.previousUserData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["comments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["user", "interactions", "comments"],
      });
    },
  });
}
