"use client";

/*
   const { 
    albums, 
    isLoading: albumsLoading
  } = useAdminAlbumsData(); Media Page
 * Displays all media across albums with options to select and delete.
 *
 * TODO: get all media, currently albums are not fetching medias.
 */

import { useState, useMemo } from "react";
import { useAdminAlbumsData } from "@/hooks/queries/useAdminAlbumsQuery";
import { useAdminBatchDeleteMedia } from "@/hooks/queries/useAdminMediaQuery";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { Media } from "@/types";

export default function AdminMediaPage() {
  const { albums, isLoading: albumsLoading } = useAdminAlbumsData({
    limit: 50, // Increase limit to get more media at once
  });
  const batchDeleteMutation = useAdminBatchDeleteMedia();
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<string[]>([]);

  // Combine media from all albums with memoization
  const allMedia: (Media & { albumTitle: string; albumId: string })[] =
    useMemo(() => {
      return albums.flatMap((album) =>
        (album.media || []).map((media: Media) => ({
          ...media,
          albumTitle: album.title,
          albumId: album.id,
        }))
      );
    }, [albums]);

  const handleSelectMedia = (mediaId: string) => {
    const newSelected = new Set(selectedMedia);
    if (newSelected.has(mediaId)) {
      newSelected.delete(mediaId);
    } else {
      newSelected.add(mediaId);
    }
    setSelectedMedia(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMedia.size === allMedia.length) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(allMedia.map((media) => media.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedMedia.size > 0) {
      setMediaToDelete(Array.from(selectedMedia));
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = async () => {
    try {
      // Group media by album for deletion
      const mediaByAlbum = new Map<string, string[]>();

      mediaToDelete.forEach((mediaId) => {
        const media = allMedia.find((m) => m.id === mediaId);
        if (media) {
          const album = albums.find((a) =>
            a.media?.some((m: Media) => m.id === mediaId)
          );
          if (album) {
            if (!mediaByAlbum.has(album.id)) {
              mediaByAlbum.set(album.id, []);
            }
            mediaByAlbum.get(album.id)!.push(mediaId);
          }
        }
      });

      // Prepare batch delete data
      const mediaItems = Array.from(mediaByAlbum.entries()).flatMap(
        ([albumId, mediaIds]) =>
          mediaIds.map((mediaId) => ({ albumId, mediaId }))
      );

      // Delete media using batch mutation
      await batchDeleteMutation.mutateAsync(mediaItems);

      setSelectedMedia(new Set());
    } catch (error) {
      console.error("Error deleting media:", error);
    } finally {
      setDeleteDialogOpen(false);
      setMediaToDelete([]);
    }
  };

  if (albumsLoading) {
    return (
      <div className="px-6 space-y-6">
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
            <div className="flex items-center space-x-3">
              <div className="h-9 w-24 bg-muted/50 rounded animate-pulse"></div>
              <div className="h-9 w-32 bg-muted/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="h-10 bg-muted/50 rounded animate-pulse"></div>
            </div>
            <div className="w-48">
              <div className="h-10 bg-muted/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Media Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 overflow-hidden">
                <div className="aspect-square bg-muted/50"></div>
                <div className="p-2">
                  <div className="h-3 bg-muted/50 rounded w-3/4 mb-1"></div>
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
    <div className="px-6 space-y-6">
      <div className="bg-gradient-to-r from-admin-primary/10 to-admin-secondary/10 rounded-xl p-6 border border-admin-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Media Management
              </h1>
              <p className="text-muted-foreground">
                Manage all media across your albums
              </p>
            </div>
          </div>

          {selectedMedia.size > 0 && (
            <div className="flex items-center gap-4">
              <div className="bg-admin-warning/10 border border-admin-warning/20 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-admin-warning-foreground">
                  {selectedMedia.size} selected
                </span>
              </div>
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-all duration-200 shadow-lg flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
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
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {allMedia.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No media found
          </h3>
          <p className="text-muted-foreground">
            Upload media to your albums to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-admin-primary hover:text-admin-primary/80 transition-colors"
                >
                  {selectedMedia.size === allMedia.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <div className="h-4 w-px bg-border"></div>
                <span className="text-sm text-muted-foreground">
                  {allMedia.length} media items total
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <button className="p-1 rounded text-admin-primary bg-background shadow-sm">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <VirtualizedGrid
            items={allMedia}
            hasNextPage={false}
            isFetchingNextPage={false}
            emptyState={{
              title: "No media found",
              description: "No media items match your current filters.",
            }}
            contentCardProps={{
              customActions: (item: Media) => [
                {
                  label: selectedMedia.has(item.id) ? "Deselect" : "Select",
                  icon: (
                    <div
                      className={`w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                        selectedMedia.has(item.id)
                          ? "bg-admin-primary border-admin-primary shadow-lg"
                          : "bg-white/90 border-white/90"
                      }`}
                    >
                      {selectedMedia.has(item.id) && (
                        <svg
                          className="w-4 h-4 text-white m-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  ),
                  onClick: () => handleSelectMedia(item.id),
                  variant: "default" as const,
                },
              ],
            }}
          />
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Media"
        message={`Are you sure you want to delete ${
          mediaToDelete.length
        } media item${
          mediaToDelete.length === 1 ? "" : "s"
        }? This action cannot be undone.`}
        confirmVariant="danger"
      />
    </div>
  );
}
