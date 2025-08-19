"use client";

import { useState } from "react";
import axios from "axios";
import { Media } from "@/types";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/admin/FileUpload";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CoverImageSelector } from "@/components/admin/CoverImageSelector";
import {
  useAdminUploadMedia,
  useAdminDeleteMedia,
  useAdminBatchDeleteMedia,
} from "@/hooks/queries/useAdminMediaQuery";
import { useRemoveMediaFromAlbum } from "@/hooks/queries/useAdminAlbumsQuery";
import { formatDateShort, formatFileSize, isImage } from "@/lib/utils";
import {
  composeMediaUrl,
  composeThumbnailUrls,
  getBestThumbnailUrl,
} from "@/lib/urlUtils";
import ResponsivePicture from "@/components/ui/ResponsivePicture";

interface MediaManagerProps {
  albumId: string;
  albumTitle: string;
  media: Media[];
  onMediaChange: () => void;
  showUploadOnly?: boolean;
  showMediaLibraryOnly?: boolean;
  // Cover image selector props
  currentCoverUrl?: string;
  onCoverSelect?: (coverUrl?: string) => void;
  coverUpdateLoading?: boolean;
}

export function MediaManager({
  albumId,
  media,
  onMediaChange,
  showUploadOnly = false,
  showMediaLibraryOnly = false,
  currentCoverUrl,
  onCoverSelect,
  coverUpdateLoading = false,
}: MediaManagerProps) {
  // TanStack Query hooks
  const uploadMutation = useAdminUploadMedia();
  const deleteMutation = useAdminDeleteMedia();
  const bulkDeleteMutation = useAdminBatchDeleteMedia();
  const removeFromAlbumMutation = useRemoveMediaFromAlbum();

  // Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );

  // Loading state from mutations
  const loading =
    uploadMutation.isPending ||
    deleteMutation.isPending ||
    bulkDeleteMutation.isPending ||
    removeFromAlbumMutation.isPending;

  // Error from mutations
  const error =
    uploadMutation.error?.message ||
    deleteMutation.error?.message ||
    bulkDeleteMutation.error?.message ||
    removeFromAlbumMutation.error?.message ||
    null;

  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    mediaId?: string;
    mediaFilename?: string;
    isBulk?: boolean;
  }>({
    isOpen: false,
  });

  const handleFileUpload = async (files: File[]) => {
    try {
      // Upload files one by one with progress tracking
      for (const file of files) {
        const fileId = `${file.name}-${Date.now()}`;

        try {
          setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

          // Step 1: Get presigned URL
          const uploadResult = await uploadMutation.mutateAsync({
            albumId,
            mediaData: {
              filename: file.name,
              mimeType: file.type,
              size: file.size,
            },
          });

          // Step 2: Upload to S3 with progress tracking
          await axios.put(uploadResult.uploadUrl, file, {
            headers: {
              "Content-Type": file.type,
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = progressEvent.total
                ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                : 0;
              setUploadProgress((prev) => ({
                ...prev,
                [fileId]: percentCompleted,
              }));
            },
          });
        } finally {
          // Clean up progress after 2 seconds
          setTimeout(() => {
            setUploadProgress((prev) => {
              const newProgress = { ...prev };
              delete newProgress[fileId];
              return newProgress;
            });
          }, 2000);
        }
      }

      // Wait a moment for the upload to complete, then refresh
      setTimeout(() => {
        onMediaChange();
      }, 1000);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  };

  const handleSelectMedia = (mediaId: string, selected: boolean) => {
    setSelectedMedia((prev) =>
      selected ? [...prev, mediaId] : prev.filter((id) => id !== mediaId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedMedia(selected ? media.map((m) => m.id) : []);
  };

  const handleDeleteClick = (mediaItem: Media) => {
    setDeleteConfirm({
      isOpen: true,
      mediaId: mediaItem.id,
      mediaFilename: mediaItem.filename,
      isBulk: false,
    });
  };

  const handleRemoveFromAlbumClick = async (mediaItem: Media) => {
    try {
      await removeFromAlbumMutation.mutateAsync({
        albumId,
        mediaId: mediaItem.id,
      });
      onMediaChange();
    } catch (error) {
      console.error("Remove from album failed:", error);
    }
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
        await bulkDeleteMutation.mutateAsync(selectedMedia);
        setSelectedMedia([]);
      } else if (deleteConfirm.mediaId) {
        await deleteMutation.mutateAsync(deleteConfirm.mediaId);
      }
      setDeleteConfirm({ isOpen: false });
      onMediaChange();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const allSelected = media.length > 0 && selectedMedia.length === media.length;
  const someSelected =
    selectedMedia.length > 0 && selectedMedia.length < media.length;

  return (
    <div className="space-y-6">
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
            <p className="text-destructive font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {!showMediaLibraryOnly && (
        <div className="bg-card shadow-lg rounded-xl p-6 border border-border">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-foreground">
              Upload Media
            </h3>
          </div>
          <FileUpload
            onFilesSelected={handleFileUpload}
            accept="image/*,video/*"
            multiple
            disabled={loading}
            uploadProgress={uploadProgress}
          />
        </div>
      )}

      {/* Cover Image Selector */}
      {!showUploadOnly && !showMediaLibraryOnly && onCoverSelect && (
        <div className="bg-card shadow-lg rounded-xl p-6 border border-border">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-admin-accent to-admin-secondary rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
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
            <h3 className="text-xl font-semibold text-foreground">
              Album Cover
            </h3>
          </div>
          <p className="text-muted-foreground mb-6">
            Select a cover image for this album from the uploaded media
          </p>
          <CoverImageSelector
            albumId={albumId}
            {...(currentCoverUrl && { currentCoverUrl })}
            onCoverSelect={onCoverSelect}
            disabled={coverUpdateLoading}
          />
          {coverUpdateLoading && (
            <div className="mt-4 flex items-center text-admin-primary">
              <div className="w-4 h-4 border-2 border-admin-primary border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-sm">Updating cover image...</span>
            </div>
          )}
        </div>
      )}

      {/* Media Grid */}
      {!showUploadOnly && (
        <div className="bg-card shadow-lg rounded-xl border border-border">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-admin-primary to-admin-secondary rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
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
                <h3 className="text-xl font-semibold text-foreground">
                  Media Library ({media.length})
                </h3>
              </div>
              {selectedMedia.length > 0 && (
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
                  Delete Selected ({selectedMedia.length})
                </Button>
              )}
            </div>

            {media.length > 0 && (
              <div className="mt-4 flex items-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 text-admin-primary focus:ring-admin-primary border-border rounded"
                />
                <label className="ml-2 text-sm text-muted-foreground">
                  Select all media
                </label>
              </div>
            )}
          </div>

          {media.length === 0 ? (
            <div className="p-12 text-center">
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
                No media uploaded yet
              </h3>
              <p className="text-muted-foreground">
                Upload your first media files to get started
              </p>
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {media.map((mediaItem) => (
                  <div
                    key={mediaItem.id}
                    className="relative group bg-muted/20 rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-200"
                  >
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={selectedMedia.includes(mediaItem.id)}
                        onChange={(e) =>
                          handleSelectMedia(mediaItem.id, e.target.checked)
                        }
                        className="h-4 w-4 text-admin-primary focus:ring-admin-primary border-border rounded"
                      />
                    </div>

                    <div className="aspect-square">
                      {isImage(mediaItem) ? (
                        <ResponsivePicture
                          thumbnailUrls={composeThumbnailUrls(
                            mediaItem.thumbnailUrls
                          )}
                          fallbackUrl={getBestThumbnailUrl(
                            mediaItem.thumbnailUrls,
                            mediaItem.thumbnailUrl || mediaItem.url,
                            "small"
                          )}
                          alt={mediaItem.originalFilename || mediaItem.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={composeMediaUrl(mediaItem.url)}
                          className="w-full h-full object-cover"
                          controls={false}
                          muted
                        />
                      )}
                    </div>

                    <div className="p-4 bg-card">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {mediaItem.originalFilename || mediaItem.filename}
                      </h4>
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center justify-between">
                          <span>{formatFileSize(mediaItem.size)}</span>
                          <span>{formatDateShort(mediaItem.createdAt)}</span>
                        </div>
                        {mediaItem.width && mediaItem.height && (
                          <div className="text-center">
                            {mediaItem.width} × {mediaItem.height}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(`/media/${mediaItem.id}`, "_blank")
                          }
                          className="flex-1 border-admin-primary/30 text-admin-primary hover:bg-admin-primary hover:text-admin-primary-foreground"
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveFromAlbumClick(mediaItem)}
                          className="text-orange-600 border-orange-600/30 hover:bg-orange-600 hover:text-white"
                          disabled={loading}
                        >
                          Remove
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteClick(mediaItem)}
                          className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={deleteConfirm.isBulk ? "Delete Media" : "Delete Media"}
        message={
          deleteConfirm.isBulk
            ? `Are you sure you want to delete ${selectedMedia.length} selected media items? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteConfirm.mediaFilename}"? This action cannot be undone.`
        }
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
