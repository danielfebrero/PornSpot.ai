"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import {
  composeMediaUrl,
  composeThumbnailUrls,
  getBestThumbnailUrl,
} from "@/lib/urlUtils";
import { Media } from "@/types";

interface MediaWithSelection extends Media {
  selected: boolean;
}

interface CoverImageSelectorProps {
  selectedMedia: MediaWithSelection[];
  currentCoverImageId?: string;
  onCoverSelect: (coverImageId?: string) => void;
  disabled?: boolean;
}

export function CoverImageSelector({
  selectedMedia,
  currentCoverImageId,
  onCoverSelect,
  disabled = false,
}: CoverImageSelectorProps) {
  const t = useTranslations("user.coverImageSelector");
  const [isOpen, setIsOpen] = useState(false);

  const selectedCount = selectedMedia.filter((media) => media.selected).length;
  const selectedMediaItems = selectedMedia.filter((media) => media.selected);

  const handleImageSelect = useCallback(
    (mediaId: string) => {
      const newCoverImageId =
        currentCoverImageId === mediaId ? undefined : mediaId;
      onCoverSelect(newCoverImageId);
    },
    [currentCoverImageId, onCoverSelect]
  );

  const currentCoverMedia = selectedMediaItems.find(
    (media) => media.id === currentCoverImageId
  );

  // Don't show the selector if no media is selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">
          {t("coverImage")}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          {isOpen ? (
            <>
              {t("hideImages")} <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              {t("chooseFromSelected", { count: selectedCount })}{" "}
              <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {currentCoverMedia && (
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">
            {t("currentCover")}:
          </div>
          <div className="relative w-20 h-20 border border-border rounded overflow-hidden bg-muted">
            <ResponsivePicture
              thumbnailUrls={composeThumbnailUrls(
                currentCoverMedia.thumbnailUrls || {}
              )}
              fallbackUrl={getBestThumbnailUrl(
                composeThumbnailUrls(currentCoverMedia.thumbnailUrls || {}),
                composeMediaUrl(currentCoverMedia.url),
                "cover"
              )}
              alt={currentCoverMedia.originalFilename || "Cover image"}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {isOpen && (
        <div className="space-y-3">
          {selectedMediaItems.length === 0 ? (
            <div className="text-muted-foreground text-sm py-4 text-center">
              {t("noImagesSelected")}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {selectedMediaItems.map((media) => {
                const isSelected = currentCoverImageId === media.id;

                return (
                  <div
                    key={media.id}
                    className={`relative aspect-square border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? "border-admin-primary shadow-md"
                        : "border-border hover:border-admin-primary/30"
                    }`}
                    onClick={() => handleImageSelect(media.id)}
                  >
                    <ResponsivePicture
                      thumbnailUrls={composeThumbnailUrls(
                        media.thumbnailUrls || {}
                      )}
                      fallbackUrl={getBestThumbnailUrl(
                        composeThumbnailUrls(media.thumbnailUrls || {}),
                        composeMediaUrl(media.url),
                        "cover"
                      )}
                      alt={media.originalFilename || media.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1">
                        <div className="bg-admin-primary text-admin-primary-foreground rounded-full p-1 shadow-lg">
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
                      {media.originalFilename || media.filename}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {currentCoverImageId
                ? t("coverImageSelected")
                : t("noCoverSelected")}
            </div>
            <div className="space-x-2">
              {currentCoverImageId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleImageSelect(currentCoverImageId)}
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                >
                  {t("clearSelection")}
                </Button>
              )}
              <Button type="button" onClick={() => setIsOpen(false)} size="sm">
                {t("done")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
