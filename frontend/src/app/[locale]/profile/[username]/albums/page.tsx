"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderOpen, Grid, List, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";
import { useAlbums } from "@/hooks/queries/useAlbumsQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { useDevice } from "@/contexts/DeviceContext";
import { useGetMinimalUser } from "@/hooks/queries/useUserQuery";
import Avatar from "@/components/ui/Avatar";

export default function UserAlbumsPage() {
  const params = useParams();
  const username = params.username as string;
  const t = useTranslations("profile.albums");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { isMobile } = useDevice();

  // Use TanStack Query hook to fetch albums data
  const {
    data: albumsData,
    isLoading: loading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: loadingMore,
  } = useAlbums({ user: username, limit: 12, includeContentPreview: true });

  const { data: userData } = useGetMinimalUser({ username });

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Extract all albums from paginated data
  const albums = useMemo(() => {
    return albumsData?.pages.flatMap((page) => page.albums) || [];
  }, [albumsData]);

  const hasNext = hasNextPage || false;

  // Prefetch interaction status for all profile albums
  useEffect(() => {
    if (albums.length > 0) {
      const targets = albums.map((album) => ({
        targetType: "album" as const,
        targetId: album.id,
      }));
      prefetch(targets).catch((error) => {
        console.error(
          "Failed to prefetch profile album interaction status:",
          error
        );
      });
    }
  }, [albums, prefetch]);

  const loadMore = () => {
    if (hasNextPage) {
      fetchNextPage();
    }
  };

  const displayName = username;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Loading state
  if (loading && !loadingMore) {
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

            {/* Albums grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl p-4 border border-border"
                >
                  <div className="aspect-video bg-muted rounded-lg mb-4"></div>
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
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
          <h2 className="text-xl font-semibold text-foreground">
            {t("albumsNotFound")}
          </h2>
          <p className="text-muted-foreground mt-2">{error?.message}</p>
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
                    <FolderOpen className="w-4 h-4 text-green-500 shrink-0" />
                    <h1 className="text-lg font-bold text-foreground">
                      {t("userAlbumsTitle", { username: displayName })}
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
                      <FolderOpen className="w-5 h-5 text-green-500" />
                      <h1 className="text-2xl font-bold text-foreground">
                        {t("userAlbumsTitle", { username: displayName })}
                      </h1>
                    </div>
                    <p className="text-muted-foreground">
                      {t("albumCount", { count: albums.length })}
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

          {/* Albums content */}
          <VirtualizedGrid
            items={albums}
            viewMode={viewMode}
            isLoading={loading && !loadingMore}
            hasNextPage={hasNext}
            isFetchingNextPage={loadingMore}
            onLoadMore={loadMore}
            scrollRestorationKey="profile-albums-grid"
            contentCardProps={{
              canLike: true,
              canBookmark: true,
              canFullscreen: false,
              canAddToAlbum: false,
              showTags: false,
              showCounts: true,
              preferredThumbnailSize:
                viewMode === "grid" ? undefined : "originalSize",
            }}
            emptyState={{
              icon: <FolderOpen className="w-16 h-16 text-muted-foreground" />,
              title: t("noAlbumsYet"),
              description: t("noPublicAlbumsDescription", {
                username: displayName,
              }),
            }}
            loadingState={{
              skeletonCount: 6,
              loadingText: t("loadingMoreAlbums"),
              noMoreText: t("noMoreAlbums"),
            }}
            error={error ? String(error) : null}
            className={cn(isMobile && "px-0", !isMobile && "px-4")}
          />
        </div>
      </div>
    </div>
  );
}
