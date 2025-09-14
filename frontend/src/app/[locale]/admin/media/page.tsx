"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { Image as ImageIcon, MoreVertical, Trash2, X } from "lucide-react";
import { useAdminMediaData } from "@/hooks/queries/useAdminMediaQuery";
import { useBulkDeleteMedia } from "@/hooks/queries/useMediaQuery";
import { Button } from "@/components/ui/Button";
import { ShareDropdown } from "@/components/ui/ShareDropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function AdminMediaPage() {
  const t = useTranslations("admin.media");
  const tCommon = useTranslations("common");

  const {
    media,
    isLoading: loading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAdminMediaData({ limit: 20 });

  // Select-many state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMedias, setSelectedMedias] = useState<Set<string>>(new Set());
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  const MAX_BULK_SELECTION = 50;

  const totalCount = useMemo(() => media.length, [media]);

  const bulkDeleteMedia = useBulkDeleteMedia();

  // Memoize load more function
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handlers for selection mode
  const handleSelectMany = useCallback(() => setIsSelecting(true), []);

  const handleCancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedMedias(new Set());
  }, []);

  const handleToggleSelection = useCallback(
    (mediaId: string) => {
      setSelectedMedias((prev) => {
        const next = new Set(prev);
        if (next.has(mediaId)) {
          next.delete(mediaId);
        } else if (next.size < MAX_BULK_SELECTION) {
          next.add(mediaId);
        }
        return next;
      });
    },
    [MAX_BULK_SELECTION]
  );

  const handleDelete = useCallback(() => {
    if (selectedMedias.size > 0) setShowDeleteConfirmDialog(true);
  }, [selectedMedias]);

  const handleConfirmDelete = useCallback(async () => {
    if (selectedMedias.size === 0) return;
    try {
      const ids = Array.from(selectedMedias);
      setIsSelecting(false);
      setShowDeleteConfirmDialog(false);
      await bulkDeleteMedia.mutateAsync(ids);
      setSelectedMedias(new Set());
    } catch (e) {
      // Error toast handled by mutation layer
      console.error("Bulk delete failed", e);
    }
  }, [selectedMedias, bulkDeleteMedia]);

  if (loading && media.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted/50 rounded-lg animate-pulse"></div>
              <div>
                <div className="h-6 bg-muted/50 rounded w-32 mb-2 animate-pulse"></div>
                <div className="h-4 bg-muted/50 rounded w-48 animate-pulse"></div>
              </div>
            </div>
            <div className="h-9 w-32 bg-muted/50 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Media Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-square bg-muted/50"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                  <div className="h-3 bg-muted/50 rounded w-1/2"></div>
                  <div className="flex justify-between items-center mt-3">
                    <div className="h-6 w-16 bg-muted/50 rounded"></div>
                    <div className="h-8 w-20 bg-muted/50 rounded"></div>
                  </div>
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
      <div
        className={`$${""} ${
          isSelecting
            ? "sticky top-0 z-40 bg-background/60 backdrop-blur-lg border-border/50 shadow-2xl rounded-none border-x-0 border-t-0 border-b"
            : "bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl border border-admin-primary/20 shadow-lg"
        } p-6`}
      >
        {isSelecting ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-admin-primary/20 text-admin-primary text-sm font-bold px-3 py-1.5 rounded-lg border border-admin-primary/30 shadow-sm">
                {selectedMedias.size}/{MAX_BULK_SELECTION}
              </div>
              <button
                onClick={handleDelete}
                className="group p-3 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 focus:bg-red-500/30 focus:outline-none transition-all flex items-center border border-red-500/30 shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2 text-sm font-medium">
                  {tCommon("delete")}
                </span>
              </button>
            </div>
            <button
              onClick={handleCancelSelection}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/50 bg-background/50"
              aria-label="Cancel selection"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("media")}
                </h1>
                <p className="text-muted-foreground">
                  {t("manageAndReviewAllMediaContent")}
                </p>
              </div>
              <span className="bg-admin-primary/15 text-admin-primary text-sm font-semibold px-3 py-1.5 rounded-full">
                {tCommon("itemsCount", { count: totalCount })}
              </span>
            </div>
            <ShareDropdown
              trigger={({ toggle }) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggle}
                  className="h-10 px-2 bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-accent-foreground shadow-lg"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              )}
            >
              {({ close }) => (
                <button
                  onClick={() => {
                    handleSelectMany();
                    close();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <span>
                    {tCommon("selectMany", { default: "Select many" })}
                  </span>
                </button>
              )}
            </ShareDropdown>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-destructive mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-destructive font-medium">
              {error?.message || tCommon("anErrorOccurred")}
            </p>
          </div>
        </div>
      )}

      {/* Media Grid with Infinite Scroll */}
      <VirtualizedGrid
        items={media}
        viewMode="grid"
        isLoading={loading && media.length === 0}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={loadMore}
        scrollRestorationKey="admin-media-grid"
        isSelecting={isSelecting}
        selectedItems={selectedMedias}
        onToggleSelection={handleToggleSelection}
        gridColumns={{
          mobile: 2,
          sm: 3,
          md: 4,
          lg: 5,
          xl: 6,
        }}
        contentCardProps={{
          canLike: true,
          canBookmark: true,
          canFullscreen: true,
          canAddToAlbum: false,
          canDownload: false,
          canDelete: true,
          showTags: true,
          showCounts: true,
        }}
        emptyState={{
          icon: (
            <div className="w-20 h-20 bg-gradient-to-br from-admin-primary/20 to-admin-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="h-10 w-10 text-admin-primary" />
            </div>
          ),
          title: t("noMediaFound"),
          description: t("mediaContentWillAppearHere"),
        }}
        loadingState={{
          loadingText: t("loadingMedia"),
          noMoreText: t("allMediaLoaded"),
          skeletonCount: 8,
        }}
        error={error ? String(error) : null}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirmDialog}
        onClose={() => setShowDeleteConfirmDialog(false)}
        onConfirm={handleConfirmDelete}
        title={tCommon("confirmDeleteTitle", { default: "Delete selected?" })}
        message={tCommon("confirmDeleteMessage", {
          default: "Are you sure you want to delete the selected items?",
          count: selectedMedias.size,
        })}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        confirmVariant="danger"
        loading={bulkDeleteMedia.isPending}
      />
    </div>
  );
}
