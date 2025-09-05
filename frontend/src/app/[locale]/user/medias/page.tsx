"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ImageIcon,
  Grid,
  List,
  Plus,
  MoreVertical,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import LocaleLink from "@/components/ui/LocaleLink";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { EditTitleDialog } from "@/components/ui/EditTitleDialog";
import { ShareDropdown } from "@/components/ui/ShareDropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddToAlbumDialog } from "@/components/user/AddToAlbumDialog";
import {
  useUserMedia,
  useUpdateMedia,
  useBulkDeleteMedia,
  useDownloadMediaZip,
} from "@/hooks/queries/useMediaQuery";
import { usePrefetchInteractionStatus } from "@/hooks/queries/useInteractionsQuery";
import { Media, UnifiedMediaResponse } from "@/types";
import { useUserContext } from "@/contexts/UserContext";
import { useDevice } from "@/contexts/DeviceContext";
import { isMediaOwner } from "@/lib/userUtils";
import { Globe, Lock, Edit } from "lucide-react";

const UserMediasPage: React.FC = () => {
  const t = useTranslations("user.medias");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingMedia, setEditingMedia] = useState<Media | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMedias, setSelectedMedias] = useState<Set<string>>(new Set());
  const [showAddToAlbumDialog, setShowAddToAlbumDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [mobileExpandedAction, setMobileExpandedAction] = useState<
    string | null
  >(null);
  const { user } = useUserContext();
  const { isMobile } = useDevice();

  // Use TanStack Query hook for media updates
  const updateMedia = useUpdateMedia();

  // Use TanStack Query hook for bulk deletion
  const bulkDeleteMedia = useBulkDeleteMedia();

  // Use TanStack Query hook for downloading media as zip
  const downloadMediaZip = useDownloadMediaZip();

  // Use TanStack Query hook for user media with infinite scroll
  const {
    data: mediaData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserMedia();

  // Hook for bulk prefetching interaction status
  const { prefetch } = usePrefetchInteractionStatus();

  // Handler for confirming title edit
  const handleConfirmTitleEdit = useCallback(
    async (newTitle: string) => {
      if (!editingMedia) return;

      try {
        await updateMedia.mutateAsync({
          mediaId: editingMedia.id,
          updates: { title: newTitle },
        });
        console.log(
          `Updating title for media ${editingMedia.id} to "${newTitle}"`
        );
        setEditingMedia(null);
      } catch (error) {
        console.error("Failed to update media title:", error);
      }
    },
    [editingMedia, updateMedia]
  );

  // Extract media from infinite query data
  const allMedias = useMemo(() => {
    return (
      mediaData?.pages.flatMap(
        (page: UnifiedMediaResponse) => page.media || []
      ) || []
    );
  }, [mediaData]);

  // Filter out invalid media before counting
  const medias = useMemo(() => {
    return allMedias.filter((media: Media) => media && media.id);
  }, [allMedias]);

  const totalCount = medias.length;

  // Generate custom actions for media owners
  const getCustomActions = useMemo(() => {
    return (media: Media) => {
      const isOwner = isMediaOwner(user, media.createdBy);
      if (!isOwner) return [];

      return [
        {
          label: media.isPublic ? "Make Private" : "Make Public",
          icon: media.isPublic ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Globe className="w-4 h-4" />
          ),
          onClick: async () => {
            try {
              await updateMedia.mutateAsync({
                mediaId: media.id,
                updates: { isPublic: !media.isPublic },
              });
              console.log(`Toggled visibility for media ${media.id}`);
            } catch (error) {
              console.error("Failed to toggle media visibility:", error);
            }
          },
          variant: "default" as const,
        },
        {
          label: "Edit Title",
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            setEditingMedia(media);
          },
          variant: "default" as const,
        },
      ];
    };
  }, [user, updateMedia]);

  // Handler for select many action
  const handleSelectMany = useCallback(() => {
    setIsSelecting(true);
  }, []);

  // Handler for cancel selection
  const handleCancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedMedias(new Set());
    setMobileExpandedAction(null);
  }, []);

  // Handler for toggling media selection
  const handleToggleSelection = useCallback((mediaId: string) => {
    setSelectedMedias((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mediaId)) {
        newSet.delete(mediaId);
      } else {
        newSet.add(mediaId);
      }
      return newSet;
    });
  }, []);

  // Handler for mobile action button tap
  const handleMobileActionTap = useCallback(
    (actionId: string, action: () => void) => {
      if (mobileExpandedAction === actionId) {
        // Second tap - trigger action
        action();
        setMobileExpandedAction(null);
      } else {
        // First tap - show label
        setMobileExpandedAction(actionId);
      }
    },
    [mobileExpandedAction]
  );

  // Handler for add to album
  const handleAddToAlbum = useCallback(() => {
    if (selectedMedias.size > 0) {
      setShowAddToAlbumDialog(true);
    }
  }, [selectedMedias]);

  // Get selected media objects
  const selectedMediaObjects = useMemo(() => {
    return medias.filter((media) => selectedMedias.has(media.id));
  }, [medias, selectedMedias]);

  // Handler for closing add to album dialog
  const handleCloseAddToAlbumDialog = useCallback(() => {
    setShowAddToAlbumDialog(false);
  }, []);

  // Handler for download
  const handleDownload = useCallback(async () => {
    if (selectedMedias.size === 0) return;

    try {
      const mediaIds = Array.from(selectedMedias);
      console.log("Downloading", mediaIds.length, "media files as zip");

      await downloadMediaZip.mutateAsync(mediaIds);

      // Clear selection after successful download
      setSelectedMedias(new Set());
      setIsSelecting(false);
    } catch (error) {
      console.error("Failed to download media zip:", error);
      // Error handling is done by the mutation
    }
  }, [selectedMedias, downloadMediaZip]);

  // Handler for delete
  const handleDelete = useCallback(() => {
    if (selectedMedias.size > 0) {
      setShowDeleteConfirmDialog(true);
    }
  }, [selectedMedias]);

  // Handler for confirming delete
  const handleConfirmDelete = useCallback(async () => {
    if (selectedMedias.size === 0) return;

    try {
      const mediaIds = Array.from(selectedMedias);
      setIsSelecting(false);
      setShowDeleteConfirmDialog(false);
      bulkDeleteMedia.mutateAsync(mediaIds);
      setSelectedMedias(new Set());
    } catch (error) {
      console.error("Failed to delete media:", error);
    }
  }, [selectedMedias, bulkDeleteMedia]);

  // Load more data when approaching the end
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Prefetch interaction status for all user media
  useEffect(() => {
    if (medias.length > 0) {
      const targets = medias.map((media) => ({
        targetType: "media" as const,
        targetId: media.id,
      }));
      prefetch(targets).catch((error) => {
        console.error(
          "Failed to prefetch user media interaction status:",
          error
        );
      });
    }
  }, [medias, prefetch]);

  if (isLoading) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`bg-gradient-to-r from-admin-accent/10 to-admin-primary/10 rounded-xl border border-admin-accent/20 shadow-lg p-6 ${
          isSelecting ? "sticky top-0 z-20" : ""
        }`}
      >
        {isSelecting ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">
                Selected: {selectedMedias.size}
              </span>
              <button
                onClick={handleCancelSelection}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Cancel selection"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Check if we're on mobile (touch device)
                  if (isMobile) {
                    handleMobileActionTap("addToAlbum", handleAddToAlbum);
                  } else {
                    handleAddToAlbum();
                  }
                }}
                className={`group p-2 rounded-md text-admin-accent hover:bg-admin-accent/10 focus:bg-admin-accent/10 focus:outline-none transition-all flex items-center overflow-hidden ${
                  mobileExpandedAction === "addToAlbum"
                    ? "bg-admin-accent/10"
                    : ""
                }`}
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span
                  className={`opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 text-sm whitespace-nowrap ml-0 group-hover:ml-2 group-focus:ml-2 max-w-0 group-hover:max-w-20 group-focus:max-w-20 ${
                    mobileExpandedAction === "addToAlbum"
                      ? "opacity-100 ml-2 max-w-20"
                      : ""
                  }`}
                >
                  Album
                </span>
              </button>
              <button
                onClick={() => {
                  if (isMobile) {
                    handleMobileActionTap("download", handleDownload);
                  } else {
                    handleDownload();
                  }
                }}
                className={`group p-2 rounded-md text-foreground hover:bg-muted focus:bg-muted focus:outline-none transition-all flex items-center overflow-hidden ${
                  mobileExpandedAction === "download" ? "bg-muted" : ""
                }`}
              >
                <Download className="h-4 w-4 flex-shrink-0" />
                <span
                  className={`opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 text-sm whitespace-nowrap ml-0 group-hover:ml-2 group-focus:ml-2 max-w-0 group-hover:max-w-24 group-focus:max-w-24 ${
                    mobileExpandedAction === "download"
                      ? "opacity-100 ml-2 max-w-24"
                      : ""
                  }`}
                >
                  Download
                </span>
              </button>
              <button
                onClick={() => {
                  if (isMobile) {
                    handleMobileActionTap("delete", handleDelete);
                  } else {
                    handleDelete();
                  }
                }}
                className={`group p-2 rounded-md text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 focus:outline-none transition-all flex items-center overflow-hidden ${
                  mobileExpandedAction === "delete" ? "bg-red-500/10" : ""
                }`}
              >
                <Trash2 className="h-4 w-4 flex-shrink-0" />
                <span
                  className={`opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 text-sm whitespace-nowrap ml-0 group-hover:ml-2 group-focus:ml-2 max-w-0 group-hover:max-w-20 group-focus:max-w-20 ${
                    mobileExpandedAction === "delete"
                      ? "opacity-100 ml-2 max-w-20"
                      : ""
                  }`}
                >
                  Delete
                </span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Layout */}
            <div className="block sm:hidden space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      {t("medias")}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {t("personalMediaGallery")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="bg-admin-accent/20 text-admin-accent text-sm font-semibold px-3 py-1.5 rounded-full">
                  {t("mediasCount", {
                    count: totalCount,
                    hasNextPage: hasNextPage ? 1 : 0,
                  })}
                </span>
                <div className="flex items-center space-x-2">
                  <ShareDropdown
                    trigger={({ toggle }) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggle}
                        className="h-10 px-2 bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    )}
                  >
                    {({ close }) => (
                      <button
                        onClick={() => {
                          handleSelectMany();
                          close();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        <span>{t("selectMany")}</span>
                      </button>
                    )}
                  </ShareDropdown>
                  <LocaleLink href="/generate">
                    <Button className="bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>{t("generate")}</span>
                    </Button>
                  </LocaleLink>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-admin-accent to-admin-primary rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    {t("medias")}
                  </h1>
                  <p className="text-muted-foreground">
                    {t("personalMediaGallery")}
                  </p>
                </div>
                <span className="bg-admin-accent/20 text-admin-accent text-sm font-semibold px-3 py-1.5 rounded-full">
                  {t("mediasCount", {
                    count: totalCount,
                    hasNextPage: hasNextPage ? 1 : 0,
                  })}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <ShareDropdown
                  trigger={({ toggle }) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggle}
                      className="h-10 px-2 bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  )}
                >
                  {({ close }) => (
                    <button
                      onClick={() => {
                        handleSelectMany();
                        close();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      <span>{t("selectMany")}</span>
                    </button>
                  )}
                </ShareDropdown>
                <LocaleLink href="/generate">
                  <Button className="bg-gradient-to-r from-admin-accent to-admin-primary hover:from-admin-accent/90 hover:to-admin-primary/90 text-admin-accent-foreground shadow-lg flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>{t("generateMedia")}</span>
                  </Button>
                </LocaleLink>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={
                    viewMode === "grid"
                      ? "bg-admin-accent text-admin-accent-foreground hover:bg-admin-accent/90"
                      : ""
                  }
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={
                    viewMode === "list"
                      ? "bg-admin-accent text-admin-accent-foreground hover:bg-admin-accent/90"
                      : ""
                  }
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {medias.length > 0 ? (
        <VirtualizedGrid
          items={medias}
          viewMode={viewMode}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={loadMore}
          scrollRestorationKey="user-medias-grid"
          isSelecting={isSelecting}
          selectedItems={selectedMedias}
          onToggleSelection={handleToggleSelection}
          contentCardProps={{
            canLike: true,
            canBookmark: true,
            canFullscreen: true,
            canAddToAlbum: true,
            canDownload: true,
            canDelete: true,
            showCounts: true,
            showTags: false,
            customActions: getCustomActions,
            preferredThumbnailSize:
              viewMode === "grid" ? undefined : "originalSize",
            inActions: {
              addToAlbum: true,
              removeFromAlbum: true,
              download: true,
              delete: true,
            },
          }}
          mediaList={medias}
          emptyState={{
            icon: (
              <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            ),
            title: t("noMediaYet"),
            description: t("startCreatingMedia"),
            action: (
              <LocaleLink href="/generate">
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>{t("generateMedia")}</span>
                </Button>
              </LocaleLink>
            ),
          }}
          loadingState={{
            loadingText: t("loadingMoreMedia"),
            noMoreText: t("noMoreMediaToLoad"),
          }}
        />
      ) : (
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-lg border border-admin-primary/10 p-12 text-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {t("noMediaYet")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("startCreatingMedia")}
          </p>
          <div className="flex justify-center space-x-4">
            <LocaleLink href="/generate">
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>{t("generateMedia")}</span>
              </Button>
            </LocaleLink>
          </div>
        </div>
      )}

      {/* Edit Title Dialog */}
      {editingMedia && (
        <EditTitleDialog
          isOpen={!!editingMedia}
          onClose={() => setEditingMedia(null)}
          onConfirm={handleConfirmTitleEdit}
          currentTitle={editingMedia.originalFilename || ""}
          loading={updateMedia.isPending}
        />
      )}

      {/* Add to Album Dialog */}
      {showAddToAlbumDialog && selectedMediaObjects.length > 0 && (
        <AddToAlbumDialog
          isOpen={showAddToAlbumDialog}
          onClose={handleCloseAddToAlbumDialog}
          media={selectedMediaObjects}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirmDialog}
        onClose={() => setShowDeleteConfirmDialog(false)}
        onConfirm={handleConfirmDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteMessage", { count: selectedMedias.size })}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        confirmVariant="danger"
        loading={bulkDeleteMedia.isPending}
      />
    </div>
  );
};

export default UserMediasPage;
