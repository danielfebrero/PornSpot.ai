import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAlbumMedia } from "@/hooks/queries/useMediaQuery";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import { useTranslations } from "next-intl";
import {
  composeMediaUrl,
  composeThumbnailUrls,
  getBestThumbnailUrl,
} from "@/lib/urlUtils";

interface CoverImageSelectorProps {
  albumId: string;
  currentCoverUrl?: string;
  onCoverSelect: (imageData: { url: string }) => void;
  disabled?: boolean;
}

export function CoverImageSelector({
  albumId,
  currentCoverUrl,
  onCoverSelect,
  disabled = false,
}: CoverImageSelectorProps) {
  const tCover = useTranslations("albums.coverImageSelector");
  const [isOpen, setIsOpen] = useState(false);

  // Use TanStack Query hook for album media
  const {
    data: mediaData,
    isLoading: loading,
    error,
  } = useAlbumMedia({ albumId });

  // Extract media from the paginated response
  const media = mediaData?.pages?.[0]?.media || [];

  const selectedCoverUrl = currentCoverUrl || "";

  const handleImageSelect = useCallback(
    (imageData: { url: string }) => {
      onCoverSelect(imageData);
      if (imageData.url) {
        setIsOpen(false);
      }
    },
    [onCoverSelect]
  );

  if (error) {
    return (
      <div className="border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">
          {tCover("coverImage")}
        </h3>
        <div className="text-destructive text-sm">
          {tCover("errorLoading")}: {error?.message || tCover("unknownError")}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">
          {tCover("coverImage")}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          {isOpen ? (
            <>
              {tCover("hideImages")} <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              {tCover("chooseFromAlbum")}{" "}
              <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {selectedCoverUrl && (
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-2">
            {tCover("currentCover")}:
          </div>
          <div className="relative w-20 h-20 border border-border rounded overflow-hidden bg-muted">
            <ResponsivePicture
              fallbackUrl={composeMediaUrl(selectedCoverUrl)}
              alt={tCover("currentCover")}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {isOpen && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-muted-foreground text-sm py-4 text-center">
              {tCover("loadingImages")}
            </div>
          ) : media.length === 0 ? (
            <div className="text-muted-foreground text-sm py-4 text-center">
              {tCover("noImagesFound")}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {media.map((image) => {
                const imageUrl = image.url;
                const isSelected = selectedCoverUrl === imageUrl;
                if (!imageUrl) return null;

                return (
                  <div
                    key={image.id}
                    className={`relative aspect-square border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary shadow-md"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    onClick={() => handleImageSelect({ url: imageUrl })}
                  >
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
                    {isSelected && (
                      <div className="absolute top-1 right-1">
                        <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
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
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {selectedCoverUrl
                ? tCover("coverSelected")
                : tCover("noCoverSelected")}
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
                  {tCover("clearSelection")}
                </Button>
              )}
              <Button type="button" onClick={() => setIsOpen(false)} size="sm">
                {tCover("done")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
