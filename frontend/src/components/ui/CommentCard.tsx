"use client";

import React, { use, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { ContentCard } from "@/components/ui/ContentCard";
import { CommentItem } from "@/components/ui/Comment";
import { CommentWithTarget as CommentType, Media, Album } from "@/types";
import { cn } from "@/lib/utils";
import {
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/queries/useCommentsQuery";
import { useUserContext } from "@/contexts/UserContext";

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
  const { user } = useUserContext();
  const currentUserId = user?.userId;

  // Use provided interaction data instead of making individual API calls
  const displayLikeState = currentUserId ? interactionData : undefined;

  // Mutations
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();

  // Edit comment handler
  const handleEditComment = useCallback(
    async (commentId: string, content: string) => {
      try {
        // Use TanStack Query optimistic updates directly
        await updateCommentMutation.mutateAsync({
          commentId,
          content,
        });

        // Optionally call parent callback for additional logic
        if (onCommentUpdate) {
          const updatedCommentWithTarget: CommentType = {
            ...comment,
            content,
            updatedAt: new Date().toISOString(),
            isEdited: true,
          };
          onCommentUpdate(updatedCommentWithTarget);
        }
      } catch (err) {
        console.error("Error updating comment:", err);
        // TanStack Query optimistic updates will handle rollback automatically
      }
    },
    [updateCommentMutation, onCommentUpdate, comment]
  );

  // Delete comment handler
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        // Use TanStack Query optimistic updates directly
        await deleteCommentMutation.mutateAsync(commentId);

        // Optionally call parent callback for additional logic
        if (onCommentDelete) {
          onCommentDelete(commentId);
        }
      } catch (err) {
        console.error("Error deleting comment:", err);
        // TanStack Query optimistic updates will handle rollback automatically
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
