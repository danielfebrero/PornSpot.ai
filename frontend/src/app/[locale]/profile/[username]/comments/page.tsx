"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Mail, Grid, List, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { VirtualizedCommentsList } from "@/components/ui/VirtualizedCommentsList";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";
import { useCommentsQuery } from "@/hooks/queries/useCommentsQuery";
import { CommentWithTarget as CommentType } from "@/types";
import { useDevice } from "@/contexts/DeviceContext";

export default function UserCommentsPage() {
  const params = useParams();
  const username = params.username as string;

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const { isMobile } = useDevice();

  // Use the new TanStack Query hook for fetching user comments
  const {
    data: commentsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage: hasMore,
    isFetchingNextPage: isLoadingMore,
    refetch: refresh,
  } = useCommentsQuery({ username, includeContentPreview: true });

  // Extract comments from paginated data and explicitly type them
  const extractedComments =
    commentsData?.pages.flatMap((page) => page.comments) || [];
  const comments: CommentType[] = extractedComments as unknown as CommentType[];
  const totalCount = comments.length; // TanStack Query doesn't provide total count in unified pagination

  // Load more function that handles the click event
  const loadMore = () => {
    if (hasMore && !isLoadingMore) {
      fetchNextPage();
    }
  };

  // Refresh function for button clicks
  const handleRefresh = () => {
    refresh();
  };

  const displayName = username;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Loading state
  if (isLoading && !comments.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto md:px-4 sm:px-6 lg:px-8 md:py-8">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </div>

            {/* Comments skeleton */}
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl p-6 border border-border"
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
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Failed to load comments
          </h2>
          <p className="text-muted-foreground mb-4">
            {(error as Error)?.message || "An error occurred"}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto md:px-4 sm:px-6 lg:px-8 md:py-8">
        <div className="space-y-6">
          {/* Header */}
          <Card
            className="border-border/50 shadow-lg"
            hideBorder={isMobile}
            hideMargin={isMobile}
          >
            <CardHeader className={cn("pb-6", isMobile && "p-0")}>
              {isMobile ? (
                // Mobile layout - simplified design
                <div className="flex items-center gap-3">
                  <LocaleLink href={`/profile/${username}`}>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </LocaleLink>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <h1 className="text-lg font-bold text-foreground">
                      {displayName}&apos;s Comments
                    </h1>
                  </div>
                </div>
              ) : (
                // Desktop layout - original horizontal design
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Back button */}
                    <LocaleLink href={`/profile/${username}`}>
                      <Button variant="ghost" size="sm" className="p-2">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    </LocaleLink>

                    {/* User avatar */}
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                      {initials}
                    </div>

                    <div>
                      <h1 className="text-2xl font-bold text-foreground">
                        {displayName}&apos;s Comments
                      </h1>
                      <p className="text-muted-foreground">
                        {totalCount > 0 ? (
                          <>
                            {totalCount} comment{totalCount !== 1 ? "s" : ""}{" "}
                            made
                          </>
                        ) : comments.length > 0 ? (
                          <>
                            {comments.length} comment
                            {comments.length !== 1 ? "s" : ""} loaded
                          </>
                        ) : (
                          "No comments yet"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* View mode toggle - only on desktop */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Comments Content */}
          <VirtualizedCommentsList
            comments={comments}
            isLoading={isLoading && !comments.length}
            hasNextPage={hasMore}
            isFetchingNextPage={isLoadingMore}
            onLoadMore={loadMore}
            error={error ? String(error) : null}
            onRetry={handleRefresh}
            className={cn(isMobile && "px-0", !isMobile && "px-4")}
            isMobile={isMobile}
            viewMode={viewMode}
          />
        </div>
      </div>
    </div>
  );
}
