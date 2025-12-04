"use client";

import { useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { Media } from "@/types";
import { ContentCard } from "@/components/ui/ContentCard";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { useDevice } from "@/contexts/DeviceContext";
import { ComponentErrorBoundary } from "@/components/ErrorBoundaries";
import { ChevronDown, ChevronUp, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoRowProps {
  videos: Media[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isFetchingNextPage?: boolean;
  className?: string;
  scrollRestorationKey?: string;
}

export function VideoRow({
  videos,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isFetchingNextPage = false,
  className,
  scrollRestorationKey,
}: VideoRowProps) {
  const t = useTranslations("discover");
  const { isMobile, isTablet, isDesktop } = useDevice();
  const searchParams = useSearchParams();
  const router = useLocaleRouter();

  // Use URL param to track expanded state so back button works
  const isExpanded = searchParams.get("expandVideos") === "true";

  const toggleExpand = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (isExpanded) {
      params.delete("expandVideos");
    } else {
      params.set("expandVideos", "true");
    }
    const queryString = params.toString();
    const path = queryString ? `/?${queryString}` : "/";
    router.push(path);
  }, [isExpanded, searchParams, router]);

  // Calculate how many videos to show based on device
  // Desktop: 4 videos in a row (same as ContentGrid)
  // Tablet: 2x2 grid = 4 videos
  // Mobile: 4 videos in column
  const getPreviewCount = () => {
    if (isMobile) return 4;
    if (isTablet) return 4;
    return 4; // Desktop: 4 videos in a row (matches ContentGrid)
  };

  const previewCount = getPreviewCount();
  const previewVideos = useMemo(
    () => videos.slice(0, previewCount),
    [videos, previewCount]
  );

  const hasMoreToShow = videos.length > previewCount || hasMore;

  // Loading skeleton
  if (isLoading && videos.length === 0) {
    return (
      <div className={cn("mb-8", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {t("videos")}
          </h2>
        </div>
        <div
          className={cn(
            "grid gap-4",
            isMobile && "grid-cols-1",
            isTablet && "grid-cols-2",
            isDesktop && "grid-cols-4"
          )}
        >
          {Array.from({ length: previewCount }).map((_, index) => (
            <div
              key={index}
              className="aspect-video bg-card/50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // No videos
  if (videos.length === 0 && !isLoading) {
    return null;
  }

  return (
    <ComponentErrorBoundary context="Video Row">
      <div className={cn("mb-8", className)}>
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("videos")}
            </h2>
            {videos.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({videos.length}
                {hasMore ? "+" : ""})
              </span>
            )}
          </div>

          {/* View All / Collapse button */}
          {hasMoreToShow && (
            <button
              onClick={toggleExpand}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              {isExpanded ? (
                <>
                  {t("collapse")}
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  {t("viewAll")}
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Content */}
        {isExpanded ? (
          /* Expanded: Full grid with infinite scroll */
          <VirtualizedGrid
            items={videos}
            className="min-h-[200px]"
            viewMode="grid"
            isLoading={isFetchingNextPage}
            hasNextPage={hasMore}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={onLoadMore}
            scrollRestorationKey={
              scrollRestorationKey
                ? `${scrollRestorationKey}-expanded`
                : undefined
            }
            gridColumns={{
              mobile: 1,
              sm: 2,
              md: 3,
              lg: 4,
              xl: 5,
            }}
            contentCardProps={{
              canLike: true,
              canBookmark: true,
              canFullscreen: true,
              canAddToAlbum: true,
              canDownload: false,
              canDelete: false,
            }}
          />
        ) : (
          /* Collapsed: Preview row */
          <div
            className={cn(
              "grid gap-4",
              isMobile && "grid-cols-1",
              isTablet && "grid-cols-2",
              isDesktop && "grid-cols-4"
            )}
          >
            {previewVideos.map((video) => (
              <ContentCard
                key={video.id}
                item={video}
                canLike={true}
                canBookmark={true}
                canFullscreen={true}
                canAddToAlbum={true}
                canDownload={false}
                canDelete={false}
                aspectRatio="auto"
              />
            ))}
          </div>
        )}
      </div>
    </ComponentErrorBoundary>
  );
}
