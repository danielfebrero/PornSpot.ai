import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { interactionApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import { UnifiedCommentsResponse } from "@/types/user";
import { CreateCommentRequest } from "@/types";

// Types
interface CommentsQueryParams {
  username: string;
  limit?: number;
}

// Hook for fetching user's comments with infinite scroll
export function useCommentsQuery(params: CommentsQueryParams) {
  const { username, limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.user.interactions.comments({ username, limit }),
    queryFn: async ({ pageParam }): Promise<UnifiedCommentsResponse> => {
      return await interactionApi.getCommentsByUsername(
        username,
        limit,
        pageParam
      );
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
    onSuccess: (response, variables) => {
      const { targetType, targetId } = variables;

      // Invalidate target comments query to ensure consistency if used elsewhere
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.byTarget(targetType, targetId),
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
    onSuccess: (response) => {
      // Invalidate all comment queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["comments"],
      });
    },
  });
}

export function useDeleteComment() {
  return useMutation({
    mutationFn: async (commentId: string) => {
      return await interactionApi.deleteComment(commentId);
    },
    onSuccess: (response) => {
      if (response.success) {
        // Invalidate all comment queries to ensure consistency
        queryClient.invalidateQueries({
          queryKey: ["comments"],
        });
      }
    },
  });
}
