"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Comment } from "@/types";
import { CommentItem } from "@/components/ui/Comment";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useDevice } from "@/contexts/DeviceContext";
import {
  useCommentInteractionsQuery,
  useToggleCommentLike,
} from "@/hooks/queries/useCommentInteractionsQuery";
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
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [hasMore, setHasMore] = useState(initialComments.length >= 20); // Assume more if we got a full page
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    commentId?: string;
  }>({
    isOpen: false,
  });
  const { isMobileInterface: isMobile } = useDevice();

  // Use TanStack Query for fetching additional comments (load more functionality)
  // Disabled by default since we use SSG comments initially
  const {
    data: additionalCommentsData,
    fetchNextPage: loadMoreComments,
    isFetchingNextPage: loadingMore,
    error: fetchError,
  } = useTargetComments(targetType, targetId, { limit: 20, enabled: false });

  // Update comments list when we get additional comments from load more
  useEffect(() => {
    if (additionalCommentsData?.pages) {
      const newComments = additionalCommentsData.pages.flatMap(
        (page) => page.data?.comments || []
      );
      if (newComments.length > 0) {
        // Filter out comments we already have to avoid duplicates
        const existingIds = new Set(comments.map((c) => c.id));
        const uniqueNewComments = newComments.filter(
          (c) => !existingIds.has(c.id)
        );

        if (uniqueNewComments.length > 0) {
          setComments((prev) => [...prev, ...uniqueNewComments]);

          // Check if there are more comments to load
          const lastPage =
            additionalCommentsData.pages[
              additionalCommentsData.pages.length - 1
            ];
          setHasMore(!!lastPage.data?.pagination?.hasNext);
        }
      }
    }
  }, [additionalCommentsData, comments]);

  // Memoize comment IDs to prevent unnecessary re-renders and API calls
  const commentIds = useMemo(() => {
    if (!currentUserId) return [];
    return comments.map((comment) => comment.id);
  }, [comments, currentUserId]);

  // Comment interaction hooks using TanStack Query
  const {
    data: commentLikeStates = {},
    isLoading: likeStatesLoading,
    error: likeStatesError,
  } = useCommentInteractionsQuery(commentIds);

  // Comment mutation hooks
  const createCommentMutation = useCreateComment();
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();
  const toggleCommentLikeMutation = useToggleCommentLike();

  // Submit new comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId || createCommentMutation.isPending)
      return;

    try {
      const result = await createCommentMutation.mutateAsync({
        content: newComment.trim(),
        targetType,
        targetId,
      });

      // Add new comment to local state
      if (result.success && result.data) {
        setComments((prev) => [result.data!, ...prev]);
      }

      setNewComment("");
    } catch (err) {
      console.error("Error creating comment:", err);
    }
  };

  // Edit comment
  const handleEditComment = async (commentId: string, content: string) => {
    try {
      const result = await updateCommentMutation.mutateAsync({
        commentId,
        content,
      });

      // Update comment in local state
      if (result.success && result.data) {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId ? result.data! : comment
          )
        );
      }
    } catch (err) {
      console.error("Error updating comment:", err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    setDeleteConfirm({
      isOpen: true,
      commentId,
    });
  };

  // Confirm delete comment
  const handleConfirmDelete = async () => {
    const commentId = deleteConfirm.commentId;
    if (!commentId || deleteCommentMutation.isPending) return;

    try {
      const result = await deleteCommentMutation.mutateAsync(commentId);

      // Remove comment from local state
      if (result.success) {
        setComments((prev) =>
          prev.filter((comment) => comment.id !== commentId)
        );
      }

      setDeleteConfirm({ isOpen: false });
    } catch (err) {
      console.error("Error deleting comment:", err);
      setDeleteConfirm({ isOpen: false });
    }
  };

  // Like comment
  const handleLikeComment = useCallback(
    (commentId: string) => {
      if (!currentUserId) {
        return;
      }

      // Get current like state
      const currentIsLiked = commentLikeStates[commentId]?.isLiked || false;

      // Use the TanStack Query mutation which handles optimistic updates
      toggleCommentLikeMutation.mutate({
        commentId,
        isCurrentlyLiked: currentIsLiked,
      });
    },
    [currentUserId, commentLikeStates, toggleCommentLikeMutation]
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
      {likeStatesLoading && commentIds.length > 0 && comments.length === 0 ? (
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
            // Check like state if user is logged in (regardless of like count)
            // This handles the case where a comment goes from 0 to 1+ likes
            const likeState = currentUserId
              ? commentLikeStates[comment.id]
              : null;

            // Use like count from API if available, otherwise fall back to comment object
            const commentLikeCount =
              likeState?.likeCount !== undefined
                ? likeState.likeCount
                : comment.likeCount || 0;

            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                onLike={handleLikeComment}
                isLiked={likeState?.isLiked || false}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
