"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useLocaleRouter } from "@/lib/navigation";
import { Album } from "@/types";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Edit, Trash2, Image as ImageIcon } from "lucide-react";
import {
  useAdminAlbumsData,
  useDeleteAdminAlbum,
} from "@/hooks/queries/useAdminAlbumsQuery";

export default function AdminAlbumsPage() {
  const t = useTranslations("admin.albums");
  const tCommon = useTranslations("common");
  const router = useLocaleRouter();
  const {
    albums,
    isLoading: loading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAdminAlbumsData({ limit: 20 });

  const deleteAlbumMutation = useDeleteAdminAlbum();

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    albumId?: string;
    albumTitle?: string;
    isBulk?: boolean;
  }>({
    isOpen: false,
  });

  const handleDeleteClick = (album: Album) => {
    setDeleteConfirm({
      isOpen: true,
      albumId: album.id,
      albumTitle: album.title,
      isBulk: false,
    });
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteConfirm.albumId) {
        await deleteAlbumMutation.mutateAsync(deleteConfirm.albumId);
      }
      setDeleteConfirm({ isOpen: false });
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleManageMedia = useCallback(
    (albumId: string) => {
      router.push(`/admin/albums/${albumId}/media`);
    },
    [router]
  );

  const handleEdit = useCallback(
    (albumId: string) => {
      router.push(`/admin/albums/${albumId}`);
    },
    [router]
  );

  // Memoize load more function
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (loading && albums.length === 0) {
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

        {/* Albums Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-video bg-muted/50"></div>
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
      <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("albums")}
              </h1>
              <p className="text-muted-foreground">
                {t("manageYourPhotoAlbums")}
              </p>
            </div>
          </div>
        </div>
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

      {/* Albums Grid with Infinite Scroll */}
      <VirtualizedGrid
        items={albums}
        viewMode="grid"
        isLoading={loading && albums.length === 0}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={loadMore}
        scrollRestorationKey="admin-albums-grid"
        gridColumns={{
          mobile: 2,
          sm: 3,
          md: 4,
          lg: 5,
          xl: 6,
        }}
        contentCardProps={{
          canLike: false,
          canBookmark: false,
          canFullscreen: false,
          canAddToAlbum: false,
          canDownload: false,
          canDelete: false,
          showTags: true,
          showCounts: true,
          showIsPublic: true,
          customActions: (item) => [
            {
              label: t("editAlbum"),
              icon: <Edit className="h-4 w-4" />,
              onClick: () => handleEdit((item as Album).id),
              variant: "default" as const,
            },
            {
              label: t("manageMedia"),
              icon: <ImageIcon className="h-4 w-4" />,
              onClick: () => handleManageMedia((item as Album).id),
              variant: "default" as const,
            },
            {
              label: t("deleteAlbum"),
              icon: <Trash2 className="h-4 w-4" />,
              onClick: () => handleDeleteClick(item as Album),
              variant: "destructive" as const,
            },
          ],
        }}
        emptyState={{
          icon: (
            <div className="w-20 h-20 bg-gradient-to-br from-admin-primary/20 to-admin-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg
                className="h-10 w-10 text-admin-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
            </div>
          ),
          title: t("noAlbumsFound"),
          description: t("createFirstAlbumToGetStarted"),
        }}
        loadingState={{
          loadingText: t("loadingAlbums"),
          noMoreText: t("allAlbumsLoaded"),
          skeletonCount: 8,
        }}
        error={error ? String(error) : null}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={t("deleteAlbumConfirmTitle")}
        message={t("deleteAlbumConfirmMessage", {
          albumTitle: deleteConfirm.albumTitle || "",
        })}
        confirmText={t("delete")}
        confirmVariant="danger"
      />
    </div>
  );
}
