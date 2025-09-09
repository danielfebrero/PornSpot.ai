"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FolderOpen, Grid, List, Plus, Edit2, Trash2 } from "lucide-react";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import { Button } from "@/components/ui/Button";
import LocaleLink from "@/components/ui/LocaleLink";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { cn } from "@/lib/utils";
import {
  useAlbums,
  useUpdateAlbum,
  useDeleteAlbum,
} from "@/hooks/queries/useAlbumsQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { EditAlbumDialog } from "@/components/albums/EditAlbumDialog";
import { DeleteAlbumDialog } from "@/components/albums/DeleteAlbumDialog";
import { Album, UnifiedAlbumsResponse } from "@/types";
import { useUserContext } from "@/contexts/UserContext";

const UserAlbumsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<Album | null>(null);
  const t = useTranslations("user.albums");

  // Set document title and meta description
  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

  // Get current user info
  const { user } = useUserContext();

  // Use TanStack Query hooks for album operations
  const {
    data: albumsData,
    isLoading,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: loadingMore,
  } = useAlbums({
    user: user?.username,
    includeContentPreview: true,
  });
  const updateAlbumMutation = useUpdateAlbum();
  const deleteAlbumMutation = useDeleteAlbum();

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Extract albums and pagination from infinite query data
  // Extract albums from infinite query data
  const allAlbums = useMemo(() => {
    return (
      albumsData?.pages.flatMap(
        (page: UnifiedAlbumsResponse) => page.albums || []
      ) || []
    );
  }, [albumsData]);

  // Filter out invalid albums before counting
  const albums = useMemo(() => {
    return allAlbums.filter((album: Album) => album && album.id);
  }, [allAlbums]);

  const totalCount = albums.length;
  const error = queryError?.message;
  const hasNext = hasNextPage || false;

  // Prefetch interaction status for all user albums
  useEffect(() => {
    if (albums.length > 0) {
      const targets = albums.map((album) => ({
        targetType: "album" as const,
        targetId: album.id,
      }));
      prefetch(targets).catch((error) => {
        console.error("Failed to prefetch album interaction status:", error);
      });
    }
  }, [albums, prefetch]);

  const loadMore = () => {
    if (hasNextPage) {
      fetchNextPage();
    }
  };

  // Handle edit album
  const handleEditAlbum = useCallback((album: Album) => {
    setEditingAlbum(album);
  }, []);

  // Handle delete album
  const handleDeleteAlbum = useCallback((album: Album) => {
    setDeletingAlbum(album);
  }, []);

  // Handle album update
  const handleUpdateAlbum = useCallback(
    (
      albumId: string,
      data: {
        title?: string;
        tags?: string[];
        isPublic?: boolean;
        coverImageUrl?: string;
      }
    ) => {
      // Close dialog immediately for better UX
      setEditingAlbum(null);

      // Trigger the mutation (optimistic update will handle UI changes)
      updateAlbumMutation.mutate(
        {
          albumId,
          data,
        },
        {
          onError: (error) => {
            console.error("Failed to update album:", error);
            // Note: onError in useUpdateAlbum hook will handle rollback
          },
        }
      );
    },
    [updateAlbumMutation]
  );

  // Handle album deletion
  const handleConfirmDelete = useCallback(() => {
    if (!deletingAlbum) return;

    // Close dialog immediately for better UX
    setDeletingAlbum(null);

    // Trigger the mutation (optimistic update will handle UI changes)
    deleteAlbumMutation.mutate(deletingAlbum.id, {
      onError: (error) => {
        console.error("Failed to delete album:", error);
        // Note: onError in useDeleteAlbum hook will handle rollback
      },
    });
  }, [deletingAlbum, deleteAlbumMutation]);

  if (isLoading && !loadingMore) {
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

  if (error) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl border border-admin-primary/20 shadow-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Albums</h1>
              <p className="text-muted-foreground">
                Your personal photo collections
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-red-200 p-12 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg
              className="h-10 w-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-3">
            {t("unableToLoad")}
          </h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            {t("errorMessage", { error })}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground shadow-lg"
          >
            {t("refreshPage")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl border border-admin-primary/20 shadow-lg p-6">
          {/* Mobile Layout */}
          <div className="block sm:hidden space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {t("albums")}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t("personalCollections")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="bg-admin-primary/20 text-admin-primary text-sm font-semibold px-3 py-1.5 rounded-full">
                {t("albumsCount", {
                  count: totalCount,
                  hasNextPage: hasNextPage ? 1 : 0,
                })}
              </span>
              <LocaleLink href="/user/albums/create">
                <Button className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground shadow-lg flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>{t("create")}</span>
                </Button>
              </LocaleLink>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t("albums")}
                </h1>
                <p className="text-muted-foreground">
                  {t("personalPhotoCollections")}
                </p>
              </div>
              <span className="bg-admin-primary/20 text-admin-primary text-sm font-semibold px-3 py-1.5 rounded-full">
                {t("albumsCount", {
                  count: totalCount,
                  hasNextPage: hasNextPage ? 1 : 0,
                })}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <LocaleLink href="/user/albums/create">
                <Button className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground shadow-lg flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>{t("createAlbum")}</span>
                </Button>
              </LocaleLink>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "hidden sm:inline-flex",
                  viewMode === "grid"
                    ? "bg-admin-primary text-admin-primary-foreground hover:bg-admin-primary/90"
                    : ""
                )}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "hidden sm:inline-flex",
                  viewMode === "list"
                    ? "bg-admin-primary text-admin-primary-foreground hover:bg-admin-primary/90"
                    : ""
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <VirtualizedGrid
          items={albums}
          viewMode={viewMode}
          isLoading={isLoading && !loadingMore}
          hasNextPage={hasNext}
          isFetchingNextPage={loadingMore}
          onLoadMore={loadMore}
          scrollRestorationKey="user-albums-grid"
          contentCardProps={{
            canLike: true,
            canBookmark: true,
            canFullscreen: false,
            canAddToAlbum: false,
            canDownload: false,
            canDelete: false,
            showTags: true,
            customActions: (item) => [
              {
                label: t("editAlbum"),
                icon: <Edit2 className="h-4 w-4" />,
                onClick: () => handleEditAlbum(item as Album),
                variant: "default" as const,
              },
              {
                label: t("deleteAlbum"),
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => handleDeleteAlbum(item as Album),
                variant: "destructive" as const,
              },
            ],
          }}
          emptyState={{
            icon: (
              <div className="w-20 h-20 bg-gradient-to-br from-admin-primary/20 to-admin-secondary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="h-10 w-10 text-admin-primary" />
              </div>
            ),
            title: t("noAlbumsYet"),
            description: t("createFirstAlbum"),
            action: (
              <div className="flex justify-center space-x-4">
                <LocaleLink href="/user/albums/create">
                  <Button className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground shadow-lg flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>{t("createAlbum")}</span>
                  </Button>
                </LocaleLink>
              </div>
            ),
          }}
          loadingState={{
            loadingText: t("loadingAlbums"),
            noMoreText: t("allAlbumsLoaded"),
          }}
          error={error}
        />

        {/* Edit Album Dialog */}
        <EditAlbumDialog
          album={editingAlbum}
          open={!!editingAlbum}
          onClose={() => setEditingAlbum(null)}
          onSave={handleUpdateAlbum}
          loading={false}
        />

        {/* Delete Album Dialog */}
        <DeleteAlbumDialog
          albumTitle={deletingAlbum?.title || ""}
          open={!!deletingAlbum}
          onClose={() => setDeletingAlbum(null)}
          onConfirm={handleConfirmDelete}
          loading={false}
        />
      </div>
    </>
  );
};

export default UserAlbumsPage;
