"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart, Grid, List, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import LocaleLink from "@/components/ui/LocaleLink";
import { useLikesQuery } from "@/hooks/queries/useLikesQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { cn } from "@/lib/utils";
import { Media, UserInteraction } from "@/types";
import { useDevice } from "@/contexts/DeviceContext";
import { useGetMinimalUser } from "@/hooks/queries/useUserQuery";
import Avatar from "@/components/ui/Avatar";

export default function UserLikesPage() {
  const params = useParams();
  const username = params.username as string;
  const t = useTranslations("profile.likes");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { isMobile } = useDevice();

  // Use the TanStack Query hook to fetch likes data
  const {
    data: likesData,
    isLoading: likesLoading,
    error: likesError,
    fetchNextPage,
    hasNextPage: hasNext,
    isFetchingNextPage: loadingMore,
  } = useLikesQuery({
    targetUser: username,
    limit: 20,
    includeContentPreview: true,
  });

  const { data: userData } = useGetMinimalUser({ username });

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Extract likes from paginated data
  const likes = useMemo(() => {
    return likesData?.pages.flatMap((page) => page.interactions) || [];
  }, [likesData]);

  // Extract liked items for VirtualizedGrid
  const likedItems = useMemo(() => {
    return likes
      .filter((like) => like.target)
      .map((like) => like.target!)
      .filter(Boolean);
  }, [likes]);

  // Prefetch interaction status for all liked items
  useEffect(() => {
    if (likes.length > 0) {
      const targets = likes.map((like: UserInteraction) => ({
        targetType: like.targetType as "album" | "media",
        targetId: like.targetId,
      }));
      prefetch(targets).catch((error) => {
        console.error(
          "Failed to prefetch liked items interaction status:",
          error
        );
      });
    }
  }, [likes, prefetch]);

  const loadMore = () => {
    if (hasNext) {
      fetchNextPage();
    }
  };

  const displayName = username;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Get media items for lightbox (only media type likes)
  const mediaItems = likes
    .filter((like) => like.targetType === "media")
    .map((like) => like.target as Media)
    .filter(Boolean);

  // Loading state
  if (likesLoading) {
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

            {/* Likes grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <div className="aspect-square bg-muted"></div>
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
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
  if (likesError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t("error.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {likesError?.message || t("error.message")}
          </p>
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
            <CardHeader className={cn("pb-4", isMobile && "p-0")}>
              {isMobile ? (
                // Mobile layout - simplified design
                <div className="flex items-center gap-3">
                  <LocaleLink href={`/profile/${displayName}`}>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </LocaleLink>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500 shrink-0" />
                    <h1 className="text-lg font-bold text-foreground">
                      {t("title", { username: displayName })}
                    </h1>
                  </div>
                </div>
              ) : (
                // Desktop layout - original horizontal design
                <div className="flex items-center gap-4">
                  {/* Back button */}
                  <LocaleLink href={`/profile/${displayName}`}>
                    <Button variant="ghost" size="sm" className="p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </LocaleLink>

                  {/* User avatar and info */}
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {userData ? (
                      <Avatar user={userData} size="medium" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      <h1 className="text-2xl font-bold text-foreground">
                        {t("title", { username: displayName })}
                      </h1>
                    </div>
                    <p className="text-muted-foreground">
                      {t("count", {
                        count: likes.length,
                        hasNextPage: hasNext ? 1 : 0,
                      })}
                    </p>
                  </div>

                  {/* View mode toggle - only on desktop */}
                  <div className="flex bg-muted/50 rounded-lg p-1">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="px-3 py-1.5"
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="px-3 py-1.5"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Likes content */}
          <VirtualizedGrid
            items={likedItems}
            viewMode={viewMode}
            isLoading={likesLoading}
            hasNextPage={hasNext}
            isFetchingNextPage={loadingMore}
            onLoadMore={loadMore}
            scrollRestorationKey="profile-likes-grid"
            gridColumns={{
              mobile: 1,
              sm: 2,
              md: 3,
              lg: 3,
            }}
            contentCardProps={{
              canLike: true,
              canBookmark: true,
              canFullscreen: true,
              canAddToAlbum: true,
              showTags: false,
              showCounts: true,
              preferredThumbnailSize:
                viewMode === "grid" ? undefined : "originalSize",
            }}
            mediaList={mediaItems}
            emptyState={{
              icon: <Heart className="w-16 h-16 text-muted-foreground" />,
              title: t("empty.title"),
              description: t("empty.description", { username: displayName }),
            }}
            loadingState={{
              skeletonCount: 6,
              loadingText: t("loading.loadingMore"),
              noMoreText: t("loading.noMore"),
            }}
            error={likesError ? String(likesError) : null}
            className={cn(isMobile && "px-0", !isMobile && "px-4")}
          />
        </div>
      </div>
    </div>
  );
}
