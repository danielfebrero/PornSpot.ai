import { useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { Album, Media } from "@/types";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { ThumbnailContext } from "@/types";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";

interface ContentGridProps {
  items: (Album | Media)[];
  className?: string;
  context?: ThumbnailContext;
  loadMore?: () => void;
  loading?: boolean;
  hasMore?: boolean;
  error?: string | null;
  scrollRestorationKey?: string; // Key for scroll position restoration
}

export const ContentGrid: React.FC<ContentGridProps> = ({
  items,
  className,
  loadMore,
  loading = false,
  hasMore = false,
  error = null,
  scrollRestorationKey,
}) => {
  const t = useTranslations("contentGrid");

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Prefetch interaction status for all albums using useLayoutEffect
  // to ensure prefetch happens BEFORE child components render and make individual requests
  // Note: ContentGrid receives all albums as props, so we prefetch all of them
  useLayoutEffect(() => {
    if (items.length > 0) {
      const targets = items.map((item) => ({
        targetType: item.type,
        targetId: item.id,
      }));

      // Prefetch all item interaction status
      prefetch(targets).catch((error) => {
        console.error("Failed to prefetch album interaction status:", error);
      });
    }
  }, [items, prefetch]);

  return (
    <VirtualizedGrid
      items={items.filter((item) => item && item.id)}
      className={className}
      viewMode="grid"
      isLoading={loading}
      hasNextPage={hasMore}
      isFetchingNextPage={loading}
      onLoadMore={loadMore}
      scrollRestorationKey={scrollRestorationKey}
      contentCardProps={{
        canLike: true,
        canBookmark: true,
        canFullscreen: true,
        canAddToAlbum: true,
        canDownload: false,
        canDelete: false,
      }}
      emptyState={{
        icon: (
          <svg
            className="w-16 h-16 mx-auto text-muted-foreground mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        ),
        title: t("noContentsTitle"),
        description: t("noContentsDescription"),
      }}
      loadingState={{
        loadingText: t("loadingMore"),
        noMoreText: t("noMoreToLoad"),
      }}
      error={error}
      onRetry={loadMore}
    />
  );
};
