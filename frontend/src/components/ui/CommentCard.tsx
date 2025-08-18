"use client";

import React, { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { ContentCard } from "@/components/ui/ContentCard";
import { CommentItem } from "@/components/ui/Comment";
import { CommentWithTarget as CommentType, Media, Album } from "@/types";
import { cn } from "@/lib/utils";
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
  interactionData?: { isLiked: boolean; likeCount: number };
  onLike?: (commentId: string) => void;
}

export function CommentCard({
  comment,
  isMobile = false,
  className,
  onCommentUpdate,
  onCommentDelete,
  interactionData,
  onLike,
}: CommentCardProps) {
  // Get current user data
  const { data: userResponse } = useUserProfile();
  const user = userResponse?.user;
  const currentUserId = user?.userId;

  // Use provided interaction data instead of making individual API calls
  const displayLikeState = currentUserId ? interactionData : undefined;

  // Mutations
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();

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
      if (!currentUserId || !onLike) {
        return;
      }

      // Delegate to parent component
      onLike(commentId);
    },
    [currentUserId, onLike]
  );

  // Use like count from provided interaction data or comment object as fallback
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
