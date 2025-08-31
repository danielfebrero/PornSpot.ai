"use client";

import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { Virtuoso } from "react-virtuoso";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Media, Album } from "@/types";
import { ContentCard } from "@/components/ui/ContentCard";
import { ComponentErrorBoundary } from "@/components/ErrorBoundaries";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

// Generic type for items that can be rendered in the grid
type GridItem = Media | Album;

// View mode options
type ViewMode = "grid" | "list";

// Generic props interface
interface VirtualizedGridProps<T extends GridItem> {
  items: T[];
  className?: string;
  viewMode?: ViewMode;
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;

  // Grid configuration
  gridColumns?: {
    mobile?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  aspectRatio?: "square" | "auto";

  // Scroll restoration configuration
  scrollRestorationKey?: string;

  // Content Card configuration
  contentCardProps?: {
    canLike?: boolean;
    canBookmark?: boolean;
    canFullscreen?: boolean;
    canAddToAlbum?: boolean;
    canDownload?: boolean;
    canDelete?: boolean;
    canRemoveFromAlbum?: boolean;
    showCounts?: boolean;
    showTags?: boolean;
    preferredThumbnailSize?:
      | "cover"
      | "small"
      | "medium"
      | "large"
      | "xlarge"
      | "originalSize";
    customActions?:
      | Array<{
          label: string;
          icon: React.ReactNode;
          onClick: () => void;
          variant?: "default" | "destructive";
        }>
      // eslint-disable-next-line no-unused-vars
      | ((item: T) => Array<{
          label: string;
          icon: React.ReactNode;
          onClick: () => void;
          variant?: "default" | "destructive";
        }>);
    currentAlbumId?: string;
    inActions?: {
      addToAlbum: boolean;
      removeFromAlbum: boolean;
      download: boolean;
      delete: boolean;
    };
  };

  // Optional mediaList for lightbox navigation (media grids only)
  mediaList?: Media[];

  // Empty state configuration
  emptyState?: {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    action?: React.ReactNode;
  };

  // Loading state configuration
  loadingState?: {
    skeletonCount?: number;
    loadingText?: string;
    noMoreText?: string;
  };

  // Error handling
  error?: string | null;
  onRetry?: () => void;
}

// Default grid columns configuration
const DEFAULT_GRID_COLUMNS = {
  mobile: 1,
  sm: 2,
  md: 3,
  lg: 4,
};

/**
 * VirtualizedGrid - A reusable virtualized grid component for rendering large lists of media or albums
 *
 * Features:
 * - Virtual scrolling with react-virtuoso
 * - Responsive grid layout with customizable columns
 * - Support for both grid and list view modes
 * - Container-based responsive design
 * - Infinite loading with automatic trigger
 * - Loading, error, and empty states
 * - Type-safe props for different item types
 * - Interaction status prefetching compatibility
 * - Scroll position restoration across navigation
 *
 * @example
 * ```tsx
 * <VirtualizedGrid
 *   items={medias}
 *   itemType="media"
 *   viewMode="grid"
 *   hasNextPage={hasNextPage}
 *   onLoadMore={loadMore}
 *   scrollRestorationKey="media-grid-user-page"
 *   contentCardProps={{
 *     canLike: true,
 *     canBookmark: true,
 *     canFullscreen: true,
 *   }}
 *   mediaList={medias}
 * />
 * ```
 */
export function VirtualizedGrid<T extends GridItem>({
  items,
  className,
  viewMode = "grid",
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  gridColumns = DEFAULT_GRID_COLUMNS,
  aspectRatio = "square",
  scrollRestorationKey,
  contentCardProps = {},
  mediaList,
  emptyState,
  loadingState,
  error,
  onRetry,
}: VirtualizedGridProps<T>) {
  const t = useTranslations("ui.virtualizedGrid");

  // Container dimensions for responsive grid calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const skeletonContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Scroll restoration hook - always call but provide a default key
  const { saveScrollPosition, getInitialScrollState } = useScrollRestoration({
    storageKey: scrollRestorationKey || "default-grid-scroll",
  });

  // Get initial scroll state for restoration
  const initialScrollState = scrollRestorationKey
    ? getInitialScrollState()
    : { topMostItemIndex: 0, scrollTop: 0, hasRestoredPosition: false };

  useEffect(() => {
    const measureWidth = () => {
      const refToUse = skeletonContainerRef.current || containerRef.current;
      if (refToUse) {
        setContainerWidth(refToUse.offsetWidth);
      }
    };

    measureWidth();
    window.addEventListener("resize", measureWidth);
    return () => window.removeEventListener("resize", measureWidth);
  }, [
    containerRef.current?.offsetWidth,
    skeletonContainerRef.current?.offsetWidth,
    mediaList,
    items,
  ]);

  // Calculate grid columns based on container width
  const calculatedColumns = useMemo(() => {
    if (viewMode === "list") return 1;

    const { mobile = 1, sm = 2, md = 3, lg = 4 } = gridColumns;

    // Mobile-first approach: if container width is not yet measured, assume mobile
    if (!containerWidth) return mobile;

    // Use container width for responsive calculations
    if (containerWidth < 640) return mobile;
    if (containerWidth < 768) return sm;
    if (containerWidth < 900) return md;
    return lg;
  }, [containerWidth, viewMode, gridColumns]);

  // Convert flat items array to grid rows for virtualization
  const gridRows = useMemo(() => {
    if (viewMode === "list") {
      return items.map((item, index) => ({
        items: [item],
        startIndex: index,
      }));
    }

    const rows = [];
    for (let i = 0; i < items.length; i += calculatedColumns) {
      rows.push({
        items: items.slice(i, i + calculatedColumns),
        startIndex: i,
      });
    }
    return rows;
  }, [items, calculatedColumns, viewMode]);

  // Load more callback with distance trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  // Row renderer for virtuoso
  const renderRow = useCallback(
    (index: number) => {
      const row = gridRows[index];
      if (!row) return null;

      // Trigger load more when approaching the end
      if (index >= gridRows.length - 3) {
        loadMore();
      }

      if (viewMode === "list") {
        const item = row.items[0];
        const { customActions, ...restProps } = contentCardProps || {};
        const resolvedCustomActions =
          typeof customActions === "function"
            ? customActions(item)
            : customActions;

        const dynamicType = (item as Album | Media)?.type;

        return (
          <div key={`${dynamicType}-${item.id}`} className="mb-4">
            <ComponentErrorBoundary
              context={`${dynamicType} Card (${item.id})`}
            >
              <ContentCard
                item={item}
                aspectRatio={dynamicType === "media" ? "auto" : "square"}
                {...restProps}
                customActions={resolvedCustomActions}
                mediaList={
                  dynamicType === "media"
                    ? mediaList ||
                      (items.filter((item) => item.type === "media") as Media[])
                    : undefined
                }
                currentIndex={row.startIndex}
              />
            </ComponentErrorBoundary>
          </div>
        );
      }

      return (
        <div
          key={`row-${index}`}
          className="grid gap-4 mb-6"
          style={{
            gridTemplateColumns: `repeat(${calculatedColumns}, 1fr)`,
          }}
        >
          {row.items.map((item: T, itemIndex: number) => {
            const { customActions, ...restProps } = contentCardProps || {};
            const resolvedCustomActions =
              typeof customActions === "function"
                ? customActions(item)
                : customActions;

            // Check if item has dynamic type information
            const dynamicType = (item as Album | Media)?.type;

            return (
              <ComponentErrorBoundary
                key={`${dynamicType}-${item.id}`}
                context={`${dynamicType} Card (${item.id})`}
              >
                <ContentCard
                  item={item}
                  aspectRatio={aspectRatio}
                  {...restProps}
                  customActions={resolvedCustomActions}
                  mediaList={
                    dynamicType === "media"
                      ? mediaList ||
                        (items.filter(
                          (item) => item.type === "media"
                        ) as Media[])
                      : undefined
                  }
                  currentIndex={row.startIndex + itemIndex}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={onLoadMore}
                />
              </ComponentErrorBoundary>
            );
          })}
          {/* Fill empty slots in the last row */}
          {row.items.length < calculatedColumns &&
            Array.from({ length: calculatedColumns - row.items.length }).map(
              (_, emptyIndex) => <div key={`empty-${index}-${emptyIndex}`} />
            )}
        </div>
      );
    },
    [
      gridRows,
      calculatedColumns,
      viewMode,
      aspectRatio,
      contentCardProps,
      mediaList,
      items,
      loadMore,
      hasNextPage,
      isFetchingNextPage,
      onLoadMore,
    ]
  );

  // Loading skeleton
  if (isLoading && items.length === 0) {
    const skeletonCount = loadingState?.skeletonCount || 8;
    return (
      <div className={cn("space-y-6", className)} ref={skeletonContainerRef}>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${calculatedColumns}, 1fr)`,
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-square bg-muted/50"></div>
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

  // Empty state
  if (items.length === 0 && !isLoading) {
    if (emptyState) {
      return (
        <div className={cn("text-center py-12", className)}>
          <div className="max-w-md mx-auto">
            {emptyState.icon}
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {emptyState.title}
            </h3>
            <p className="text-muted-foreground mb-6">
              {emptyState.description}
            </p>
            {emptyState.action}
          </div>
        </div>
      );
    }

    // Default empty state
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto text-muted-foreground mb-4">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t("noContentFound")}
          </h3>
          <p className="text-muted-foreground">{t("noContentToDisplay")}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("space-y-6", className)}>
      <Virtuoso
        useWindowScroll
        data={gridRows}
        totalCount={gridRows.length}
        itemContent={renderRow}
        endReached={loadMore}
        overscan={5}
        // Scroll restoration configuration
        initialTopMostItemIndex={
          scrollRestorationKey ? initialScrollState.topMostItemIndex : 0
        }
        rangeChanged={
          scrollRestorationKey
            ? (range) => {
                // Save scroll position when range changes
                saveScrollPosition({
                  scrollTop: 0, // Not applicable for virtuoso
                  topMostItemIndex: range.startIndex,
                  timestamp: Date.now(),
                });
              }
            : undefined
        }
        scrollSeekConfiguration={{
          enter: (velocity) => Math.abs(velocity) > 200,
          exit: (velocity) => Math.abs(velocity) < 30,
        }}
        components={{
          Footer: () => {
            if (error) {
              return (
                <div className="py-8 text-center">
                  <div className="space-y-4">
                    <p className="text-red-500">
                      {t("errorLoading")}: {error}
                    </p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        disabled={isFetchingNextPage}
                      >
                        {t("tryAgain")}
                      </button>
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
                    {loadingState?.loadingText || t("loadingMoreContent")}
                  </p>
                </div>
              );
            }

            if (!hasNextPage && items.length > 0) {
              return (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    {loadingState?.noMoreText || t("noMoreContentToLoad")}
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

// Export default for easier imports
export default VirtualizedGrid;
