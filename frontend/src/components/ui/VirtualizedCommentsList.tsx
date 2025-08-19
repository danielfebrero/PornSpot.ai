"use client";

import React, { useCallback, useLayoutEffect, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CommentCard } from "@/components/ui/CommentCard";
import { CommentWithTarget as CommentType } from "@/types";
import { cn } from "@/lib/utils";
import {
  useInteractionStatus,
  usePrefetchInteractionStatus,
  useToggleLike,
} from "@/hooks/queries/useInteractionsQuery";
import { useUserProfile } from "@/hooks/queries/useUserQuery";

interface VirtualizedCommentsListProps {
  comments: CommentType[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  isMobile?: boolean;
  viewMode?: "grid" | "list";
  onCommentUpdate?: (
    updatedComment: CommentType
  ) => { rollback: () => void } | void;
  onCommentDelete?: (commentId: string) => { rollback: () => void } | void;
}

export function VirtualizedCommentsList({
  comments,
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  error,
  onRetry,
  className,
  isMobile = false,
  viewMode = "list",
  onCommentUpdate,
  onCommentDelete,
}: VirtualizedCommentsListProps) {
  // Get current user data
  const { data: userResponse } = useUserProfile();
  const user = userResponse?.user;
  const currentUserId = user?.userId;

  // Hook for manual prefetching (for interaction status)
  const { prefetch } = usePrefetchInteractionStatus();

  // Create interaction targets for all comments
  const commentTargets = useMemo(() => {
    if (!currentUserId) return [];
    return comments.map((comment) => ({
      targetType: "comment" as const,
      targetId: comment.id,
    }));
  }, [comments, currentUserId]);

  const allContentsTargets = useMemo(() => {
    if (!currentUserId) return [];
    return comments.map((comment) => ({
      targetType: comment.targetType,
      targetId: comment.target.id,
    }));
  }, [comments, currentUserId]);

  // Auto-prefetch interaction status for all loaded media
  useLayoutEffect(() => {
    if (allContentsTargets.length > 0) {
      prefetch(allContentsTargets).catch((error) => {
        console.error("Failed to prefetch media interaction status:", error);
      });
    }
  }, [allContentsTargets, prefetch]);

  // Get interaction status for all comments in one call
  const { data: interactionStatusData } = useInteractionStatus(commentTargets);

  // Create a map for easier lookup
  const commentLikeStates = useMemo(() => {
    const statusMap: Record<string, { isLiked: boolean; likeCount: number }> =
      {};

    if (interactionStatusData?.statuses) {
      interactionStatusData.statuses.forEach((status) => {
        if (status.targetType === "comment") {
          statusMap[status.targetId] = {
            isLiked: status.userLiked,
            likeCount: status.likeCount,
          };
        }
      });
    }

    return statusMap;
  }, [interactionStatusData]);

  // Toggle like mutation
  const toggleLikeMutation = useToggleLike();

  // Like comment handler
  const handleLikeComment = useCallback(
    (commentId: string) => {
      if (!currentUserId) {
        return;
      }

      // Get current like state from our centralized data
      const currentLikeState = commentLikeStates[commentId] || {
        isLiked: false,
        likeCount: comments.find((c) => c.id === commentId)?.likeCount || 0,
      };
      const currentIsLiked = currentLikeState.isLiked;

      // Use TanStack Query mutation with all comment targets for optimal cache updates
      toggleLikeMutation.mutate({
        targetType: "comment",
        targetId: commentId,
        isCurrentlyLiked: currentIsLiked,
        allTargets: commentTargets, // Pass all comment targets for efficient cache updates
      });
    },
    [
      currentUserId,
      commentLikeStates,
      comments,
      toggleLikeMutation,
      commentTargets,
    ]
  );

  // Load more callback with distance trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  // Row renderer for virtuoso
  const renderComment = useCallback(
    (index: number) => {
      const comment = comments[index];
      if (!comment) return null;

      // Trigger load more when approaching the end
      if (index >= comments.length - 3) {
        loadMore();
      }

      // Get interaction data for this comment
      const commentInteractionData = currentUserId
        ? commentLikeStates[comment.id]
        : undefined;

      if (viewMode === "list") {
        return (
          <div key={comment.id} className={cn("mb-8", isMobile && "space-y-8")}>
            <CommentCard
              comment={comment}
              isMobile={isMobile}
              onCommentUpdate={onCommentUpdate}
              onCommentDelete={onCommentDelete}
              interactionData={commentInteractionData}
              onLike={handleLikeComment}
            />
          </div>
        );
      }

      // Grid mode - render 2 comments per row
      if (index % 2 === 0) {
        const nextComment = comments[index + 1];
        const nextCommentInteractionData =
          currentUserId && nextComment
            ? commentLikeStates[nextComment.id]
            : undefined;

        return (
          <div
            key={`row-${index}`}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
          >
            <CommentCard
              comment={comment}
              isMobile={isMobile}
              onCommentUpdate={onCommentUpdate}
              onCommentDelete={onCommentDelete}
              interactionData={commentInteractionData}
              onLike={handleLikeComment}
            />
            {nextComment ? (
              <CommentCard
                comment={nextComment}
                isMobile={isMobile}
                onCommentUpdate={onCommentUpdate}
                onCommentDelete={onCommentDelete}
                interactionData={nextCommentInteractionData}
                onLike={handleLikeComment}
              />
            ) : (
              <div />
            )}
          </div>
        );
      }

      // Skip odd indices in grid mode as they're rendered with even indices
      return null;
    },
    [
      comments,
      isMobile,
      viewMode,
      loadMore,
      onCommentUpdate,
      onCommentDelete,
      currentUserId,
      commentLikeStates,
      handleLikeComment,
    ]
  );

  // Loading skeleton
  if (isLoading && comments.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-xl p-6 border border-border animate-pulse"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-muted rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (comments.length === 0 && !isLoading) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          No comments yet
        </h3>
        <p className="text-muted-foreground mb-6">
          This user hasn&apos;t made any comments yet. Check back later!
        </p>
      </div>
    );
  }

  // Calculate items for virtualization
  const virtualItems =
    viewMode === "grid"
      ? Array.from({ length: Math.ceil(comments.length / 2) }, (_, i) => i)
      : comments.map((_, i) => i);

  return (
    <div className={cn("space-y-4", className)}>
      <Virtuoso
        useWindowScroll
        data={virtualItems}
        itemContent={renderComment}
        endReached={loadMore}
        overscan={5}
        components={{
          Footer: () => {
            if (error) {
              return (
                <div className="py-8 text-center">
                  <div className="space-y-4">
                    <p className="text-red-500">Error loading: {error}</p>
                    {onRetry && (
                      <Button
                        onClick={onRetry}
                        variant="outline"
                        disabled={isFetchingNextPage}
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                </div>
              );
            }

            if (isFetchingNextPage) {
              return (
                <div className="py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-admin-accent"></div>
                  <p className="text-muted-foreground mt-2">
                    Loading more comments...
                  </p>
                </div>
              );
            }

            if (!hasNextPage && comments.length > 0) {
              return (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No more comments to load
                  </p>
                </div>
              );
            }

            return null;
          },
        }}
      />
    </div>
  );
}

export default VirtualizedCommentsList;
