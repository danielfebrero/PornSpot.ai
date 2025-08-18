"use client";

import React, { useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CommentCard } from "@/components/ui/CommentCard";
import { CommentWithTarget as CommentType } from "@/types";
import { cn } from "@/lib/utils";

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

      if (viewMode === "list") {
        return (
          <div key={comment.id} className={cn("mb-8", isMobile && "space-y-8")}>
            <CommentCard
              comment={comment}
              isMobile={isMobile}
              onCommentUpdate={onCommentUpdate}
              onCommentDelete={onCommentDelete}
            />
          </div>
        );
      }

      // Grid mode - render 2 comments per row
      if (index % 2 === 0) {
        const nextComment = comments[index + 1];
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
            />
            {nextComment ? (
              <CommentCard
                comment={nextComment}
                isMobile={isMobile}
                onCommentUpdate={onCommentUpdate}
                onCommentDelete={onCommentDelete}
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
    [comments, isMobile, viewMode, loadMore, onCommentUpdate, onCommentDelete]
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

  // Calculate total count for virtualization
  const totalCount =
    viewMode === "grid" ? Math.ceil(comments.length / 2) : comments.length;

  return (
    <div className={cn("space-y-4", className)}>
      <Virtuoso
        useWindowScroll
        data={comments}
        totalCount={totalCount}
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
