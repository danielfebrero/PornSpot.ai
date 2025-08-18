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
  onCommentUpdate?: (updatedComment: CommentType) => void;
  onCommentDelete?: (commentId: string) => void;
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
  const commentTargets = [
    { targetType: "comment" as const, targetId: comment.id },
  ];
  const { data: interactionStatusData, isLoading: likeStatesLoading } =
    useInteractionStatus(commentTargets);

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
      try {
        const result = await updateCommentMutation.mutateAsync({
          commentId,
          content,
        });

        // Call parent update callback if provided
        if (onCommentUpdate && result) {
          // Convert result to CommentWithTarget format
          const updatedCommentWithTarget: CommentType = {
            ...result,
            target: comment.target, // Preserve the target from original comment
          };
          onCommentUpdate(updatedCommentWithTarget);
        }
      } catch (err) {
        console.error("Error updating comment:", err);
      }
    },
    [updateCommentMutation, onCommentUpdate, comment.target]
  );

  // Delete comment handler
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        const result = await deleteCommentMutation.mutateAsync(commentId);

        if (result.success && onCommentDelete) {
          onCommentDelete(commentId);
        }
      } catch (err) {
        console.error("Error deleting comment:", err);
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

      // Get current like state
      const currentIsLiked = commentLikeStates[commentId]?.isLiked || false;

      // Use the unified like mutation
      toggleLikeMutation.mutate({
        targetType: "comment",
        targetId: commentId,
        isCurrentlyLiked: currentIsLiked,
      });
    },
    [currentUserId, commentLikeStates, toggleLikeMutation]
  );

  // Get like state for this comment
  const likeState = currentUserId ? commentLikeStates[comment.id] : undefined;

  // Use like count from API if available, otherwise fall back to comment object
  const commentLikeCount =
    likeState?.likeCount !== undefined
      ? likeState.likeCount
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
          isLiked={likeState?.isLiked || false}
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
