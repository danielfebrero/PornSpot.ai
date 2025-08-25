"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Grid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import LocaleLink from "@/components/ui/LocaleLink";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { useUserMedia } from "@/hooks/queries/useMediaQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { Media, UnifiedMediaResponse } from "@/types";

const UserMediasPage: React.FC = () => {
  const t = useTranslations("user.medias");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Use TanStack Query hook for user media with infinite scroll
  const {
    data: mediaData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserMedia();

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Extract media from infinite query data
  const allMedias = useMemo(() => {
    return (
      mediaData?.pages.flatMap((page: UnifiedMediaResponse) => page.media || []) || []
    );
  }, [mediaData]);

  // Filter out invalid media before counting
  const medias = useMemo(() => {
    return allMedias.filter((media: Media) => media && media.id);
  }, [allMedias]);

  const totalCount = medias.length;

  // Load more data when approaching the end
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Prefetch interaction status for all user media
  useEffect(() => {
    if (medias.length > 0) {
      const targets = medias.map((media) => ({
        targetType: "media" as const,
        targetId: media.id,
      }));
      prefetch(targets).catch((error) => {
        console.error(
          "Failed to prefetch user media interaction status:",
          error
        );
      });
    }
  }, [medias, prefetch]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted/50 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted/50 rounded w-1/2"></div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-video bg-muted/50"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                  <div className="h-3 bg-muted/50 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-admin-accent/10 to-admin-primary/10 rounded-xl border border-admin-accent/20 shadow-lg p-6">
        {/* Mobile Layout */}
        <div className="block sm:hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t("medias")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("personalMediaGallery")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="bg-admin-accent/20 text-admin-accent text-sm font-semibold px-3 py-1.5 rounded-full">
              {totalCount.toLocaleString()} {t("mediasCount")}
            </span>
            <LocaleLink href="/generate">
              <Button className="bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>{t("generate")}</span>
              </Button>
            </LocaleLink>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("medias")}</h1>
              <p className="text-muted-foreground">
                {t("personalMediaGallery")}
              </p>
            </div>
            <span className="bg-admin-accent/20 text-admin-accent text-sm font-semibold px-3 py-1.5 rounded-full">
              {totalCount.toLocaleString()} {t("mediasCount")}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <LocaleLink href="/generate">
              <Button className="bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>{t("generateMedia")}</span>
              </Button>
            </LocaleLink>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={
                viewMode === "grid"
                  ? "bg-admin-accent text-admin-accent-foreground hover:bg-admin-accent/90"
                  : ""
              }
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={
                viewMode === "list"
                  ? "bg-admin-accent text-admin-accent-foreground hover:bg-admin-accent/90"
                  : ""
              }
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {medias.length > 0 ? (
        <VirtualizedGrid
          items={medias}
          viewMode={viewMode}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={loadMore}
          contentCardProps={{
            canLike: true,
            canBookmark: true,
            canFullscreen: true,
            canAddToAlbum: true,
            canDownload: true,
            canDelete: true,
            showCounts: true,
            showTags: false,
            preferredThumbnailSize:
              viewMode === "grid" ? undefined : "originalSize",
          }}
          mediaList={medias}
          emptyState={{
            icon: (
              <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            ),
            title: t("noMediaYet"),
            description: t("startCreatingMedia"),
            action: (
              <LocaleLink href="/generate">
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>{t("generateMedia")}</span>
                </Button>
              </LocaleLink>
            ),
          }}
          loadingState={{
            loadingText: t("loadingMoreMedia"),
            noMoreText: t("noMoreMediaToLoad"),
          }}
        />
      ) : (
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-12 text-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {t("noMediaYet")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("startCreatingMedia")}
          </p>
          <div className="flex justify-center space-x-4">
            <LocaleLink href="/generate">
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>{t("generateMedia")}</span>
              </Button>
            </LocaleLink>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMediasPage;
