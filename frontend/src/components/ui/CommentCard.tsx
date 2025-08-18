"use client";

import React, { useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { ContentCard } from "@/components/ui/ContentCard";
import { CommentItem } from "@/components/ui/Comment";
import { CommentWithTarget as CommentType, Media, Album } from "@/types";
import { cn } from "@/lib/utils";
import {
  useInteractionStatus,
  useToggleLike,
} from "@/hooks/queries/useInteractionsQuery";
import {
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/queries/useCommentsQuery";
import { useUserProfile } from "@/hooks/queries/useUserQuery";

interface CommentCardProps {
  comment: CommentType;
  isMobile?: boolean;
  className?: string;
  onCommentUpdate?: (
    updatedComment: CommentType
  ) => { rollback: () => void } | void;
  onCommentDelete?: (commentId: string) => { rollback: () => void } | void;
}

export function CommentCard({
  comment,
  isMobile = false,
  className,
  onCommentUpdate,
  onCommentDelete,
}: CommentCardProps) {
  // Get current user data
  const { data: userResponse } = useUserProfile();
  const user = userResponse?.user;
  const currentUserId = user?.userId;

  // Get comment like status
  const commentTargets = useMemo(
    () => [{ targetType: "comment" as const, targetId: comment.id }],
    [comment.id]
  );

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

  // Mutations
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();
  const toggleLikeMutation = useToggleLike();

  // Edit comment handler
  const handleEditComment = useCallback(
    async (commentId: string, content: string) => {
      let rollbackFn: (() => void) | null = null;

      try {
        // Optimistic update: update comment in UI immediately
        if (onCommentUpdate) {
          // Convert to CommentWithTarget format with updated content
          const updatedCommentWithTarget: CommentType = {
            ...comment,
            content,
            updatedAt: new Date().toISOString(),
            isEdited: true,
          };

          const result = onCommentUpdate(updatedCommentWithTarget);
          // Store rollback function if provided
          if (result && typeof result === "object" && "rollback" in result) {
            rollbackFn = result.rollback;
          }
        }

        // Then perform the actual update
        const result = await updateCommentMutation.mutateAsync({
          commentId,
          content,
        });

        // If update fails, rollback the optimistic update
        if (!result) {
          console.error("Failed to update comment");
          if (rollbackFn) {
            rollbackFn();
          }
        }
      } catch (err) {
        console.error("Error updating comment:", err);
        // In case of error, rollback the optimistic update
        if (rollbackFn) {
          rollbackFn();
        }
      }
    },
    [updateCommentMutation, onCommentUpdate, comment]
  );

  // Delete comment handler
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      let rollbackFn: (() => void) | null = null;

      try {
        // Optimistic update: remove comment from UI immediately
        if (onCommentDelete) {
          const result = onCommentDelete(commentId);
          // Store rollback function if provided
          if (result && typeof result === "object" && "rollback" in result) {
            rollbackFn = result.rollback;
          }
        }

        // Then perform the actual deletion
        const result = await deleteCommentMutation.mutateAsync(commentId);

        // If deletion fails, rollback the optimistic update
        if (!result.success) {
          console.error("Failed to delete comment:", result);
          if (rollbackFn) {
            rollbackFn();
          }
        }
      } catch (err) {
        console.error("Error deleting comment:", err);
        // In case of error, rollback the optimistic update
        if (rollbackFn) {
          rollbackFn();
        }
      }
    },
    [deleteCommentMutation, onCommentDelete]
  );

  // Like comment handler
  const handleLikeComment = useCallback(
    (commentId: string) => {
      if (!currentUserId) {
        return;
      }

      // Get current like state from TanStack Query cache
      const currentLikeState = commentLikeStates[commentId] || {
        isLiked: false,
        likeCount: comment.likeCount || 0,
      };
      const currentIsLiked = currentLikeState.isLiked;

      // Use TanStack Query mutation (with built-in optimistic updates)
      // Pass commentTargets so the cache update uses the correct query key
      toggleLikeMutation.mutate({
        targetType: "comment",
        targetId: commentId,
        isCurrentlyLiked: currentIsLiked,
        allTargets: commentTargets, // Pass the targets used by this component
      });
    },
    [
      currentUserId,
      commentLikeStates,
      toggleLikeMutation,
      comment.likeCount,
      commentTargets,
    ]
  );

  // Get like state for this comment from TanStack Query cache
  const displayLikeState = currentUserId
    ? commentLikeStates[comment.id]
    : undefined;

  // Use like count from TanStack Query cache or comment object as fallback
  const commentLikeCount =
    displayLikeState?.likeCount !== undefined
      ? displayLikeState.likeCount
      : comment.likeCount || 0;

  return (
    <Card
      className={cn(
        "border-border/50 hover:shadow-md transition-shadow",
        className
      )}
      hideBorder={isMobile}
      hideMargin={isMobile}
    >
      <CardContent hidePadding={isMobile}>
        <CommentItem
          comment={{
            id: comment.id,
            content: comment.content,
            targetType: comment.targetType,
            targetId: comment.targetId,
            username: comment.username,
            userId: comment.userId,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            isEdited: comment.isEdited,
            likeCount: comment.likeCount,
          }}
          currentUserId={currentUserId}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
          onLike={handleLikeComment}
          isLiked={displayLikeState?.isLiked || false}
          likeCount={commentLikeCount}
          className="border-0 p-0"
        />
        {/* Content Preview */}
        {comment.target && (
          <div className="ml-14 mt-4">
            <div className="w-full max-w-sm">
              <ContentCard
                item={comment.target as Media | Album}
                aspectRatio="square"
                className="w-full"
                canAddToAlbum={comment.targetType !== "album"}
                canDownload={false}
                showCounts={true}
                showTags={comment.targetType === "album"}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CommentCard;
