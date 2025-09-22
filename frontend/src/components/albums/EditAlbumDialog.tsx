"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { TagManager } from "@/components/ui/TagManager";
import { Crown } from "lucide-react";
import { Album, Media } from "@/types";
import { useTranslations } from "next-intl";

interface MediaWithSelection extends Media {
  selected: boolean;
}
import { usePermissions } from "@/contexts/PermissionsContext";
import { CoverImageSelector } from "./CoverImageSelector";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import {
  composeThumbnailUrls,
  getBestThumbnailUrl,
  composeMediaUrl,
} from "@/lib/urlUtils";
import {
  useAddMediaToAlbum,
  useBulkAddMediaToAlbum,
  useBulkRemoveMediaFromAlbum,
} from "@/hooks/queries/useAlbumsQuery";

import { useRemoveMediaFromAlbum } from "@/hooks/queries/useAlbumsQuery";
import { useUserMedia, useAlbumMedia } from "@/hooks/queries/useMediaQuery";

interface MediaWithSelection extends Media {
  selected: boolean;
}

interface EditAlbumDialogProps {
  album: Album | null;
  open: boolean;
  onClose: () => void;
  onSave: any;
  loading?: boolean;
}

export function EditAlbumDialog({
  album,
  open,
  onClose,
  onSave,
  loading = false,
}: EditAlbumDialogProps) {
  const tEdit = useTranslations("albums.editAlbumDialog");
  const { canCreatePrivateContent } = usePermissions();
  const canMakePrivate = canCreatePrivateContent();

  // Media mutation hooks
  const addMediaMutation = useAddMediaToAlbum();
  const bulkAddMediaMutation = useBulkAddMediaToAlbum();
  const removeMediaMutation = useRemoveMediaFromAlbum();
  const bulkRemoveMediaMutation = useBulkRemoveMediaFromAlbum();

  // Media data hooks with infinite scroll
  const {
    data: userMediaData,
    isLoading: userMediaLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserMedia({ limit: 50 });

  const { data: albumMediaData, isLoading: albumMediaLoading } = useAlbumMedia({
    albumId: album?.id || "",
    limit: 100,
  });

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageMediaId, setCoverImageMediaId] = useState("");
  const [saving, setSaving] = useState(false);

  // Media selection state
  const [userMedia, setUserMedia] = useState<MediaWithSelection[]>([]);
  const [initiallySelectedMediaIds, setInitiallySelectedMediaIds] = useState<
    Set<string>
  >(new Set());

  // Extract flattened media from infinite query data
  const flatUserMedia = useMemo(() => {
    return userMediaData?.pages.flatMap((page) => page.media || []) || [];
  }, [userMediaData]);

  const flatAlbumMedia = useMemo(() => {
    return albumMediaData?.pages.flatMap((page) => page.media || []) || [];
  }, [albumMediaData]);

  const mediaLoading = userMediaLoading || albumMediaLoading;
  const mediaError = null; // Error handling can be added later if needed

  // Update media selection state when data changes
  useEffect(() => {
    if (!album || !flatUserMedia.length) {
      setUserMedia([]);
      setInitiallySelectedMediaIds(new Set());
      return;
    }

    // Track which media are currently in the album
    const albumMediaIds = new Set<string>(
      flatAlbumMedia.map((m: Media) => m.id)
    );
    setInitiallySelectedMediaIds(albumMediaIds);

    // Mark user media as selected if they're in the album
    const mediaWithSelection = flatUserMedia.map((media: Media) => ({
      ...media,
      selected: albumMediaIds.has(media.id),
    }));

    // Sort media so that images already in the album appear first
    const sortedMedia = mediaWithSelection.sort(
      (a: MediaWithSelection, b: MediaWithSelection) => {
        // If a is selected and b is not, a comes first
        if (a.selected && !b.selected) return -1;
        // If b is selected and a is not, b comes first
        if (b.selected && !a.selected) return 1;
        // If both have the same selection status, maintain original order
        return 0;
      }
    );

    setUserMedia(sortedMedia);
  }, [album, flatUserMedia, flatAlbumMedia]);

  // Reset form when album changes
  useEffect(() => {
    if (album) {
      setTitle(album.title || "");
      setTags(album.tags || []);
      // If user can't make content private, force album to be public
      setIsPublic(canMakePrivate ? album.isPublic || false : true);
      setCoverImageUrl(album.coverImageUrl || "");
      setCoverImageMediaId((album as any).coverImageMediaId || "");
    } else {
      setTitle("");
      setTags([]);
      setIsPublic(true); // Default to public
      setCoverImageUrl("");
      setCoverImageMediaId("");
      setUserMedia([]);
      setInitiallySelectedMediaIds(new Set());
    }
  }, [album, canMakePrivate]);

  // Load more media function for infinite scroll
  const loadMoreMedia = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle scroll event to trigger load more automatically
  const handleMediaGridScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;

      // Trigger load more when user scrolls to within 100px of the bottom
      if (scrollHeight - scrollTop <= clientHeight + 100) {
        loadMoreMedia();
      }
    },
    [loadMoreMedia]
  );

  // Toggle media selection
  const toggleMediaSelection = (mediaId: string) => {
    setUserMedia((prev) =>
      prev.map((media) =>
        media.id === mediaId ? { ...media, selected: !media.selected } : media
      )
    );
  };

  // Apply media changes (add/remove from album)
  const applyMediaChanges = async () => {
    if (!album) return;

    // Find media to add and remove
    const mediaToAdd = userMedia
      .filter((m) => m.selected && !initiallySelectedMediaIds.has(m.id))
      .map((m) => m.id);

    const mediaToRemove = userMedia
      .filter((m) => !m.selected && initiallySelectedMediaIds.has(m.id))
      .map((m) => m.id);

    const promises = [];

    // Add new media using bulk mutation if multiple, single mutation if one
    if (mediaToAdd.length > 1) {
      promises.push(
        bulkAddMediaMutation.mutateAsync({
          albumId: album.id,
          mediaIds: mediaToAdd,
        })
      );
    } else if (mediaToAdd.length === 1) {
      promises.push(
        addMediaMutation.mutateAsync({
          albumId: album.id,
          mediaId: mediaToAdd[0],
        })
      );
    }

    // Remove media using bulk mutation if multiple, single mutation if one
    if (mediaToRemove.length > 1) {
      promises.push(
        bulkRemoveMediaMutation.mutateAsync({
          albumId: album.id,
          mediaIds: mediaToRemove,
        })
      );
    } else if (mediaToRemove.length === 1) {
      promises.push(
        removeMediaMutation.mutateAsync({
          albumId: album.id,
          mediaId: mediaToRemove[0],
        })
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  const handleSave = async () => {
    if (!album || !title.trim()) return;

    setSaving(true);
    try {
      // Apply media changes first
      applyMediaChanges();

      // Then update album details
      onSave(album.id, {
        title: title.trim(),
        tags,
        isPublic,
        coverImageMediaId: coverImageMediaId || undefined,
      });
      // Note: Don't call onClose() here as the parent component
      // handles closing the dialog immediately for better UX
    } catch (error) {
      console.error("Failed to save album:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!album || !open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-card border border-border p-4 sm:p-6 shadow-2xl transition-all mx-4 sm:mx-0">
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-foreground">
              {tEdit("editAlbum")}
            </h3>
          </div>

          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <label
                htmlFor="title"
                className="block text-sm font-medium text-foreground"
              >
                {tEdit("title")}
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tEdit("titlePlaceholder")}
                className="w-full"
                disabled={saving || loading}
              />
            </div>

            {/* Tags */}
            <TagManager
              tags={tags}
              onTagsChange={setTags}
              label={tEdit("tags")}
              placeholder={tEdit("tagsPlaceholder")}
              helpText={tEdit("tagsHelpText")}
              maxTags={20}
              maxTagLength={50}
              showCounter={true}
              disabled={saving || loading}
              inputClassName="flex-1"
              buttonClassName="border-admin-primary/30 text-admin-primary hover:bg-admin-primary/10"
            />

            {/* Cover Image Selector - only show for existing albums */}
            {album && (
              <CoverImageSelector
                albumId={album.id}
                currentCoverUrl={coverImageUrl}
                onCoverSelect={(mediaId) => {
                  setCoverImageMediaId(mediaId);
                  if (!mediaId) {
                    setCoverImageUrl("");
                    return;
                  }
                }}
                disabled={saving || loading}
              />
            )}

            {/* Public Toggle */}
            <div className={`space-y-3 ${!canMakePrivate ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-foreground">
                      {tEdit("privateAlbum")}
                    </label>
                    {!canMakePrivate && (
                      <div className="flex items-center gap-1">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">
                          {tEdit("proOnly")}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {canMakePrivate
                      ? tEdit("privateDescription")
                      : tEdit("proPrivateDescription")}
                  </p>
                </div>
                <Switch
                  checked={!isPublic}
                  onCheckedChange={(checked) => {
                    if (!canMakePrivate) return;
                    setIsPublic(!checked);
                  }}
                  disabled={saving || loading || !canMakePrivate}
                />
              </div>
            </div>

            {/* Media Selection Section */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                {tEdit("albumImages")}
              </label>

              {mediaLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-primary"></div>
                </div>
              ) : mediaError ? (
                <div className="text-red-500 text-sm">{mediaError}</div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground mb-3">
                    {tEdit("selectImagesDescription")}
                  </div>

                  <div
                    className="max-h-96 overflow-y-auto border rounded-lg p-3 bg-muted/30"
                    onScroll={handleMediaGridScroll}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {userMedia.map((media) => {
                        const isSelected = media.selected;

                        return (
                          <div
                            key={media.id}
                            className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
                              isSelected
                                ? "ring-3 ring-admin-primary shadow-lg transform scale-105"
                                : "ring-1 ring-border hover:ring-border/60 hover:shadow-md"
                            }`}
                            onClick={() => toggleMediaSelection(media.id)}
                          >
                            <div className="aspect-square">
                              <ResponsivePicture
                                thumbnailUrls={composeThumbnailUrls(
                                  media.thumbnailUrls || {}
                                )}
                                fallbackUrl={getBestThumbnailUrl(
                                  composeThumbnailUrls(
                                    media.thumbnailUrls || {}
                                  ),
                                  composeMediaUrl(media.url)
                                )}
                                alt={
                                  media.originalFilename || `Media ${media.id}`
                                }
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>

                            {/* Selection Indicator */}
                            <div
                              className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-admin-primary border-admin-primary"
                                  : "bg-background border-border"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="w-4 h-4 text-admin-primary-foreground"
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
                          </div>
                        );
                      })}

                      {userMedia.length === 0 && (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          {tEdit("noMediaAvailable")}
                        </div>
                      )}
                    </div>

                    {/* Loading indicator for infinite scroll */}
                    {isFetchingNextPage && (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-admin-primary"></div>
                      </div>
                    )}

                    {/* End of results indicator */}
                    {!hasNextPage && userMedia.length > 0 && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        {tEdit("allMediaLoaded")}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving || loading}
              className="border-muted-foreground/30"
            >
              {tEdit("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || saving || loading}
              className="bg-gradient-to-r from-admin-primary to-admin-secondary hover:from-admin-primary/90 hover:to-admin-secondary/90 text-admin-primary-foreground"
            >
              {saving ? tEdit("saving") : tEdit("saveChanges")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
