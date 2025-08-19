"use client";

import { useState, useCallback, useMemo } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Comment } from "@/types";
import { CommentItem } from "@/components/ui/Comment";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useDevice } from "@/contexts/DeviceContext";
import {
  useInteractionStatus,
  useToggleLike,
} from "@/hooks/queries/useInteractionsQuery";
import {
  useTargetComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@/hooks/queries/useCommentsQuery";

interface CommentsProps {
  targetType: "album" | "media";
  targetId: string;
  initialComments?: Comment[]; // Comments already loaded from Media/Album object
  currentUserId?: string;
  className?: string;
}

export function Comments({
  targetType,
  targetId,
  initialComments = [],
  currentUserId,
  className,
}: CommentsProps) {
  const [newComment, setNewComment] = useState("");
  const { isMobileInterface: isMobile } = useDevice();

  // Use TanStack Query for fetching comments (enabled to support optimistic updates)
  const {
    data: commentsData,
    fetchNextPage: loadMoreComments,
    isFetchingNextPage: loadingMore,
    error: fetchError,
  } = useTargetComments(targetType, targetId, {
    limit: 20,
    enabled: true,
  });

  // Get comments from TanStack Query cache (supports optimistic updates)
  // If no data from cache yet, use initial comments from SSG
  const comments = useMemo(() => {
    if (commentsData?.pages && commentsData.pages.length > 0) {
      return commentsData.pages.flatMap((page) => page.comments || []);
    }
    return initialComments;
  }, [commentsData, initialComments]);

  // Check if there are more comments to load
  const hasMore = useMemo(() => {
    if (commentsData?.pages && commentsData.pages.length > 0) {
      const lastPage = commentsData.pages[commentsData.pages.length - 1];
      return !!lastPage.pagination?.hasNext;
    }
    return initialComments.length >= 20;
  }, [commentsData, initialComments]);

  // Memoize comment IDs to prevent unnecessary re-renders and API calls
  // Create interaction targets for comments
  const commentTargets = useMemo(() => {
    if (!currentUserId) return [];
    return comments.map((comment) => ({
      targetType: "comment" as const,
      targetId: comment.id,
    }));
  }, [comments, currentUserId]);

  // Use unified interaction status hook for comments
  const {
    data: interactionStatusData,
    isLoading: likeStatesLoading,
    error: likeStatesError,
  } = useInteractionStatus(commentTargets);

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

  // Comment mutation hooks
  const createCommentMutation = useCreateComment();
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();
  const toggleLikeMutation = useToggleLike();

  // Submit new comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId || createCommentMutation.isPending)
      return;

    try {
      setNewComment("");
      await createCommentMutation.mutateAsync({
        content: newComment.trim(),
        targetType,
        targetId,
      });
    } catch (err) {
      console.error("Error creating comment:", err);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId: string, content: string) => {
    try {
      await updateCommentMutation.mutateAsync({
        commentId,
        content,
      });
    } catch (err) {
      console.error("Error updating comment:", err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (deleteCommentMutation.isPending) return;

    try {
      await deleteCommentMutation.mutateAsync(commentId);
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

  // Like comment - use only TanStack Query optimistic updates
  const handleLikeComment = useCallback(
    (commentId: string) => {
      if (!currentUserId) {
        return;
      }

      // Get current like state from cache only (TanStack Query will handle optimistic updates)
      const realState = commentLikeStates[commentId];
      const currentIsLiked = realState?.isLiked || false;

      // Use the unified like mutation - TanStack Query handles all optimistic updates
      // Pass all commentTargets so the cache update uses the correct query key
      toggleLikeMutation.mutate({
        targetType: "comment",
        targetId: commentId,
        isCurrentlyLiked: currentIsLiked,
        allTargets: [{ targetType: "comment", targetId: commentId }], // Pass all comment targets for correct cache key
      });
    },
    [currentUserId, commentLikeStates, toggleLikeMutation]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const canComment = !!currentUserId;

  // Determine error state and loading states
  const error =
    fetchError ||
    likeStatesError ||
    createCommentMutation.error ||
    updateCommentMutation.error ||
    deleteCommentMutation.error;
  const submitting = createCommentMutation.isPending;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Comment form */}
      {canComment && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment..."
              className="flex-1 p-3 text-sm border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] max-h-[120px]"
              maxLength={1000}
              rows={1}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
              className="h-[44px] px-3"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {!isMobile && <span>Press Cmd+Enter to submit</span>}
            <span className={cn(!isMobile && "ml-auto")}>
              {newComment.length}/1000
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* Comments list */}
      {likeStatesLoading &&
      commentTargets.length > 0 &&
      comments.length === 0 ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment, index) => {
            // Use TanStack Query cache for like state - no local optimistic state needed
            const realState = currentUserId
              ? commentLikeStates[comment.id]
              : null;

            // Use like count from cache, otherwise fall back to comment object
            const commentLikeCount =
              realState?.likeCount !== undefined
                ? realState.likeCount
                : comment.likeCount || 0;

            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                onLike={handleLikeComment}
                isLiked={realState?.isLiked || false}
                likeCount={commentLikeCount}
                className={cn(
                  index < comments.length - 1 &&
                    "border-b border-border/20 pb-4"
                )}
              />
            );
          })}

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => loadMoreComments()}
                disabled={loadingMore}
                className="text-sm"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more comments"
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {canComment
              ? "No comments yet. Be the first to comment!"
              : "No comments yet."}
          </p>
        </div>
      )}
    </div>
  );
}
