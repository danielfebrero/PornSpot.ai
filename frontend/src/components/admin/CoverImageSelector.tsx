"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminMedia } from "@/hooks/useAdminMedia";
import { Media } from "@/types";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import {
  composeMediaUrl,
  composeThumbnailUrls,
  getBestThumbnailUrl,
} from "@/lib/urlUtils";
import { isImage } from "@/lib/utils";

interface CoverImageSelectorProps {
  albumId: string;
  currentCoverUrl?: string;
  onCoverSelect: (coverUrl: string | undefined) => void;
  disabled?: boolean;
}

export function CoverImageSelector({
  albumId,
  currentCoverUrl,
  onCoverSelect,
  disabled = false,
}: CoverImageSelectorProps) {
  const { media, loading, error, fetchAlbumMedia } = useAdminMedia();
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | undefined>(
    currentCoverUrl
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && albumId) {
      fetchAlbumMedia(albumId);
    }
  }, [isOpen, albumId, fetchAlbumMedia]);

  useEffect(() => {
    setSelectedCoverUrl(currentCoverUrl);
  }, [currentCoverUrl]);

  const handleImageSelect = (image: Media | { url: string }) => {
    // Use the original full-size URL for cover selection (backend expects this)
    const imageUrl = image.url;
    const newCoverUrl = selectedCoverUrl === imageUrl ? undefined : imageUrl;
    setSelectedCoverUrl(newCoverUrl);
    onCoverSelect(newCoverUrl);
  };

  const imageMedia = media.filter((item) => isImage(item));

  if (!isOpen) {
    return (
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Cover Image
        </label>
        <div className="space-y-3">
          {selectedCoverUrl ? (
            <div className="relative inline-block">
              <img
                src={getBestThumbnailUrl(
                  composeThumbnailUrls(
                    media.find((m) => m.url === selectedCoverUrl)
                      ?.thumbnailUrls || {}
                  ),
                  composeMediaUrl(selectedCoverUrl),
                  "medium"
                )}
                alt="Current cover"
                className="w-32 h-32 object-cover rounded-lg border-2 border-admin-primary"
              />
              <div className="absolute -top-2 -right-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-admin-primary/10 text-admin-primary">
                  Current Cover
                </span>
              </div>
            </div>
          ) : (
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <span className="text-gray-500 text-sm">No cover selected</span>
            </div>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(true)}
              disabled={disabled}
              className="border-admin-primary/30 text-admin-primary hover:bg-admin-primary hover:text-admin-primary-foreground"
            >
              {selectedCoverUrl ? "Change Cover" : "Select Cover"}
            </Button>
            {selectedCoverUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleImageSelect({ url: "" })}
                disabled={disabled}
                className="ml-2 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
              >
                Remove Cover
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        Cover Image
      </label>
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-foreground">
            Select from album images ({imageMedia.length} available)
          </h4>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            size="sm"
          >
            Close
          </Button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading images...</div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && imageMedia.length === 0 && (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              No images available in this album
            </div>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Upload some images first to select a cover
            </p>
          </div>
        )}

        {!loading && !error && imageMedia.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {imageMedia.map((image) => {
              const isSelected = selectedCoverUrl === image.url;
              return (
                <div
                  key={image.id}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? "border-admin-primary ring-2 ring-admin-primary/20"
                      : "border-border hover:border-border/80"
                  }`}
                  onClick={() => handleImageSelect(image)}
                >
                  <div className="aspect-square">
                    <ResponsivePicture
                      thumbnailUrls={composeThumbnailUrls(
                        image.thumbnailUrls || {}
                      )}
                      fallbackUrl={getBestThumbnailUrl(
                        composeThumbnailUrls(image.thumbnailUrls || {}),
                        composeMediaUrl(image.url),
                        "cover"
                      )}
                      alt={image.originalFilename || image.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {isSelected && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: "rgba(59, 130, 246, 0.2)" }}
                    >
                      <div className="bg-blue-500 text-white rounded-full p-1 shadow-lg">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                    {image.originalFilename || image.filename}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {selectedCoverUrl ? "Cover image selected" : "No cover selected"}
          </div>
          <div className="space-x-2">
            {selectedCoverUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleImageSelect({ url: "" })}
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
              >
                Clear Selection
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setIsOpen(false)}
              size="sm"
              className="bg-admin-primary hover:bg-admin-primary/90 text-admin-primary-foreground"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
