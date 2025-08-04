"use client";

import { useState } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { Album } from "@/types";
import { Button } from "@/components/ui/Button";
import { AlbumTable } from "@/components/admin/AlbumTable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  useAdminAlbumsData,
  useDeleteAdminAlbum,
  useBulkDeleteAdminAlbums,
} from "@/hooks/queries/useAdminAlbumsQuery";

export default function AdminAlbumsPage() {
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
  const bulkDeleteMutation = useBulkDeleteAdminAlbums();

  const [selectedAlbums, setSelectedAlbums] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    albumId?: string;
    albumTitle?: string;
    isBulk?: boolean;
  }>({
    isOpen: false,
  });

  const handleSelectAlbum = (albumId: string, selected: boolean) => {
    setSelectedAlbums((prev) =>
      selected ? [...prev, albumId] : prev.filter((id) => id !== albumId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedAlbums(selected ? albums.map((album) => album.id) : []);
  };

  const handleDeleteClick = (album: Album) => {
    setDeleteConfirm({
      isOpen: true,
      albumId: album.id,
      albumTitle: album.title,
      isBulk: false,
    });
  };

  const handleBulkDeleteClick = () => {
    setDeleteConfirm({
      isOpen: true,
      isBulk: true,
    });
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteConfirm.isBulk) {
        await bulkDeleteMutation.mutateAsync(selectedAlbums);
        setSelectedAlbums([]);
      } else if (deleteConfirm.albumId) {
        await deleteAlbumMutation.mutateAsync(deleteConfirm.albumId);
      }
      setDeleteConfirm({ isOpen: false });
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleEdit = (albumId: string) => {
    router.push(`/admin/albums/${albumId}`);
  };

  const handleManageMedia = (albumId: string) => {
    router.push(`/admin/albums/${albumId}/media`);
  };

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
              <h1 className="text-3xl font-bold text-foreground">Albums</h1>
              <p className="text-muted-foreground">
                Manage your photo albums and collections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedAlbums.length > 0 && (
              <Button
                variant="outline"
                onClick={handleBulkDeleteClick}
                className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L7.586 12l-1.293 1.293a1 1 0 101.414 1.414L9 13.414l2.293 2.293a1 1 0 001.414-1.414L11.414 12l1.293-1.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Delete Selected ({selectedAlbums.length})
              </Button>
            )}
            <Button
              onClick={() => router.push("/admin/albums/create")}
              className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground shadow-lg"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Create Album
            </Button>
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
              {error?.message || "An error occurred"}
            </p>
          </div>
        </div>
      )}

      <AlbumTable
        albums={albums}
        selectedAlbums={selectedAlbums}
        onSelectAlbum={handleSelectAlbum}
        onSelectAll={handleSelectAll}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onManageMedia={handleManageMedia}
        loading={loading}
      />

      {/* Load More Button for infinite scroll */}
      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
            className="min-w-[150px]"
          >
            {isFetchingNextPage ? (
              <>
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading...
              </>
            ) : (
              "Load More Albums"
            )}
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={deleteConfirm.isBulk ? "Delete Albums" : "Delete Album"}
        message={
          deleteConfirm.isBulk
            ? `Are you sure you want to delete ${selectedAlbums.length} selected albums? This action cannot be undone and will also delete all media in these albums.`
            : `Are you sure you want to delete "${deleteConfirm.albumTitle}"? This action cannot be undone and will also delete all media in this album.`
        }
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
