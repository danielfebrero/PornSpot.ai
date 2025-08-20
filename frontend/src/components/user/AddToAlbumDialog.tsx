"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Folder, FolderPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { TagManager } from "@/components/ui/TagManager";
import { Media } from "@/types";
import { usePermissions } from "@/contexts/PermissionsContext";
import { cn } from "@/lib/utils";
import {
  useAlbums,
  useCreateAlbum,
  useAddMediaToAlbum,
} from "@/hooks/queries/useAlbumsQuery";
import { useUserProfile } from "@/hooks/queries/useUserQuery";

interface AddToAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: Media;
}

export function AddToAlbumDialog({
  isOpen,
  onClose,
  media,
}: AddToAlbumDialogProps) {
  const t = useTranslations("album");
  const tCommon = useTranslations("common");
  const { canCreatePrivateContent } = usePermissions();
  const { data: userProfile } = useUserProfile();
  const user = userProfile?.user || null;

  // Use TanStack Query hooks for albums and creation
  const {
    data: albumsData,
    isLoading: albumsLoading,
    error: albumsError,
    refetch: refetchAlbums,
  } = useAlbums({
    user: user?.username,
    limit: 50,
    includeMediaIds: true,
  });

  // Extract albums from paginated data
  const albums = albumsData?.pages[0]?.albums || [];

  // Use the create album mutation
  const { mutateAsync: createAlbumHook } = useCreateAlbum();

  // Use the add media to album mutation
  const { mutateAsync: addMediaToAlbumHook } = useAddMediaToAlbum();

  // UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New album form state
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumTags, setNewAlbumTags] = useState<string[]>([]);
  const [newAlbumIsPublic, setNewAlbumIsPublic] = useState(true);
  const [useAsCover, setUseAsCover] = useState(true);

  const createAlbum = async (albumData: {
    title: string;
    tags?: string[];
    isPublic: boolean;
    mediaIds?: string[];
    coverImageId?: string;
  }) => {
    return await createAlbumHook(albumData);
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset form state
      setShowCreateForm(false);
      setNewAlbumTitle("");
      setNewAlbumTags([]);
      setNewAlbumIsPublic(true);
      setUseAsCover(true);
    }
  }, [isOpen]);

  const handleAlbumToggle = (albumId: string) => {
    const newSelected = new Set(selectedAlbumIds);
    if (newSelected.has(albumId)) {
      newSelected.delete(albumId);
    } else {
      newSelected.add(albumId);
    }
    setSelectedAlbumIds(newSelected);
  };

  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  const handleBackToList = () => {
    setShowCreateForm(false);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Create new album if form is shown
      if (showCreateForm && newAlbumTitle.trim()) {
        const newAlbum = await createAlbum({
          title: newAlbumTitle.trim(),
          tags: newAlbumTags,
          isPublic: newAlbumIsPublic,
          mediaIds: [media.id],
          ...(useAsCover && { coverImageId: media.id }),
        });

        if (newAlbum) {
          onClose();
          return;
        }
      }

      // Add to selected existing albums
      if (selectedAlbumIds.size > 0) {
        const promises = Array.from(selectedAlbumIds).map((albumId) =>
          addMediaToAlbumHook({ albumId, mediaId: media.id })
        );

        await Promise.all(promises);
        onClose();
      }
    } catch (error) {
      console.error("Failed to add media to album:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = showCreateForm
    ? newAlbumTitle.trim().length > 0
    : selectedAlbumIds.size > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {showCreateForm ? t("createAlbum") : t("addToAlbum")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label={tCommon("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
          {showCreateForm ? (
            /* Create New Album Form */
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  onClick={handleBackToList}
                  className="hover:text-foreground transition-colors"
                >
                  ← {tCommon("back")}
                </button>
              </div>

              <Input
                label={t("title")}
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder={t("enterTitle")}
                required
              />

              <TagManager
                tags={newAlbumTags}
                onTagsChange={setNewAlbumTags}
                label={t("tags")}
                placeholder={t("enterTags")}
                helpText="Press Enter to add tag"
                maxTags={20}
                maxTagLength={50}
                showCounter={true}
              />

              {canCreatePrivateContent() && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    {t("makePublic")}
                  </label>
                  <Switch
                    checked={newAlbumIsPublic}
                    onCheckedChange={setNewAlbumIsPublic}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  {t("useAsCover")}
                </label>
                <Switch checked={useAsCover} onCheckedChange={setUseAsCover} />
              </div>
            </div>
          ) : (
            /* Album Selection List */
            <div className="p-4">
              {/* Create New Album Button */}
              <button
                onClick={handleCreateNew}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-accent/50 transition-colors mb-4"
              >
                <div className="flex-shrink-0">
                  <FolderPlus className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {t("createNewAlbum")}
                </span>
              </button>

              {/* Albums List */}
              {albumsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {tCommon("loading")}...
                  </p>
                </div>
              ) : albumsError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500 mb-2">
                    {albumsError.message}
                  </p>
                  <Button
                    onClick={() => refetchAlbums()}
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </Button>
                </div>
              ) : albums && albums.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("selectExistingAlbums")}:
                  </p>
                  {albums.map((album) => {
                    const isSelected = selectedAlbumIds.has(album.id);
                    // For now, assume not already in album since we don't have that data
                    const isAlreadyInAlbum = false; // TODO: Check if media is in album

                    return (
                      <button
                        key={album.id}
                        onClick={() => handleAlbumToggle(album.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        <div className="flex-shrink-0">
                          <Folder className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {album.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {album.mediaCount || 0}{" "}
                            {album.mediaCount === 1 ? t("image") : t("images")}
                            {!album.isPublic && " • " + t("private")}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {isAlreadyInAlbum ? (
                            <span className="text-xs text-green-600 font-medium">
                              {t("alreadyAdded")}
                            </span>
                          ) : isSelected ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("noAlbumsYet")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
            className="flex-1"
          >
            {showCreateForm ? t("createAndAdd") : t("addToSelected")}
          </Button>
        </div>
      </div>
    </div>
  );
}
