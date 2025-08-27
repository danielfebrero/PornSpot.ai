import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocaleRouter } from "@/lib/navigation";
import { useNavigationLoading } from "@/contexts/NavigationLoadingContext";
import {
  Media,
  Album,
  ThumbnailContext,
  ThumbnailSize,
  ThumbnailUrls,
} from "@/types";
import { LikeButton } from "@/components/user/LikeButton";
import { BookmarkButton } from "@/components/user/BookmarkButton";
import { AddToAlbumDialog } from "@/components/user/AddToAlbumDialog";
import { Lightbox } from "@/components/ui/Lightbox";
import { Tooltip } from "@/components/ui/Tooltip";
import { Tag } from "@/components/ui/Tag";
import { ViewCount } from "@/components/ui/ViewCount";
import { cn, isVideo } from "@/lib/utils";
import { composeMediaUrl } from "@/lib/urlUtils";
import { useDevice } from "@/contexts/DeviceContext";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useRemoveMediaFromAlbum } from "@/hooks/queries/useAlbumsQuery";
import { useDeleteMedia } from "@/hooks/queries/useMediaQuery";
import {
  Maximize2,
  Plus,
  Minus,
  Download,
  Trash2,
  PlayCircle,
  MoreVertical,
  Folder,
} from "lucide-react";
import ResponsivePicture from "@/components/ui/ResponsivePicture";
import { composeThumbnailUrls } from "@/lib/urlUtils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUserContext } from "@/contexts/UserContext";

interface ContentCardProps {
  item: Media | Album;
  title?: string;
  className?: string;
  imageClassName?: string;
  aspectRatio?: "square" | "auto";

  // Button visibility controls
  canLike?: boolean;
  canBookmark?: boolean;
  canFullscreen?: boolean;
  canAddToAlbum?: boolean;
  canRemoveFromAlbum?: boolean;
  canDownload?: boolean;
  canDelete?: boolean;

  // Show counts
  showLikeCount?: boolean;
  showBookmarkCount?: boolean;
  showCounts?: boolean;

  // Show tags
  showTags?: boolean;

  // Disable hover effects
  disableHoverEffects?: boolean;

  // Layout controls
  useAllAvailableSpace?: boolean; // When true, extends to edge of screen without cropping

  // Custom dropdown actions (replaces default action buttons when provided)
  customActions?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "destructive";
  }[];

  // Control which actions should be shown in dropdown instead of as individual buttons
  inActions?: {
    like?: boolean;
    bookmark?: boolean;
    addToAlbum?: boolean;
    removeFromAlbum?: boolean;
    download?: boolean;
    delete?: boolean;
  };

  // Event handlers (optional - if not provided, default behavior will be used)
  onClick?: () => void;
  onFullscreen?: () => void;
  onAddToAlbum?: () => void;
  onRemoveFromAlbum?: () => Promise<void>;
  onDownload?: () => void;
  onDelete?: () => void;

  // Additional props for media
  context?: ThumbnailContext;
  columns?: number;

  // Thumbnail size control
  preferredThumbnailSize?: ThumbnailSize;

  // Lightbox support - pass array of media for navigation
  mediaList?: Media[];
  currentIndex?: number;

  // Infinite scroll support for lightbox
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;

  // Current album context for remove functionality
  currentAlbumId?: string;
}

export function ContentCard({
  item,
  title,
  className = "",
  imageClassName = "",
  aspectRatio = "square",
  canLike = true,
  canBookmark = true,
  canFullscreen = true,
  canAddToAlbum = true,
  canRemoveFromAlbum = false,
  canDownload = false,
  canDelete = false,
  showCounts = true,
  showTags = true,
  disableHoverEffects = false,
  useAllAvailableSpace = false,
  customActions,
  inActions,
  onClick,
  onFullscreen,
  onAddToAlbum,
  onRemoveFromAlbum,
  onDownload,
  onDelete,
  preferredThumbnailSize,
  mediaList,
  currentIndex = 0,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  currentAlbumId,
}: ContentCardProps) {
  const router = useLocaleRouter();
  const { startNavigation } = useNavigationLoading();
  const { user } = useUserContext();
  const { redirectToLogin } = useAuthRedirect();
  const removeFromAlbumMutation = useRemoveMediaFromAlbum();
  const deleteMediaMutation = useDeleteMedia();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [addToAlbumDialogOpen, setAddToAlbumDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const { isMobileInterface } = useDevice();
  const cardRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  const isMedia = item.type === "media";
  const media = isMedia ? (item as Media) : null;
  const album = !isMedia ? (item as Album) : null;

  const isVideoMedia = isMedia && media ? isVideo(media) : false;

  // Simple mobile actions timeout management
  useEffect(() => {
    if (!isMobileInterface || !showMobileActions) return;

    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;

      // Don't hide if clicking within this card
      if (cardRef.current && cardRef.current.contains(target)) {
        return;
      }

      // Hide mobile actions only for this card
      setShowMobileActions(false);
    };

    const timeoutId = setTimeout(() => {
      setShowMobileActions(false);
    }, 5000); // Auto-hide after 5 seconds

    document.addEventListener("mousedown", handleClickOutside, {
      capture: true,
    });
    document.addEventListener("touchstart", handleClickOutside, {
      capture: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, {
        capture: true,
      });
      document.removeEventListener("touchstart", handleClickOutside, {
        capture: true,
      });
      clearTimeout(timeoutId);
    };
  }, [isMobileInterface, showMobileActions]);

  // Handle dropdown outside clicks
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Element;

      // Check if click is outside both the card and the dropdown content
      const isOutsideCard =
        cardRef.current && !cardRef.current.contains(target);
      const isOutsideDropdown = !target.closest("[data-dropdown-content]");

      if (isOutsideCard && isOutsideDropdown) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [dropdownOpen]);

  // Auto-close dropdown when hover/mobile actions end
  useEffect(() => {
    if (dropdownOpen && !isHovered && !showMobileActions) {
      setDropdownOpen(false);
    }
  }, [dropdownOpen, isHovered, showMobileActions]);

  // Handle click events based on content type
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      // Custom onClick handler provided
      if (isMobileInterface) {
        // On mobile: first tap shows actions, second tap calls onClick
        if (showMobileActions) {
          // Actions are already showing, call the custom onClick
          onClick();
          setShowMobileActions(false); // Hide actions after click
        } else {
          // Actions are not showing, show them first
          e.preventDefault();
          e.stopPropagation();
          setShowMobileActions(true);
        }
        return;
      } else {
        // Desktop: direct onClick call
        onClick();
        return;
      }
    } else {
      // No custom onClick handler, use default behavior
      // On mobile: first tap shows actions, second tap navigates
      if (isMobileInterface) {
        if (showMobileActions) {
          // Actions are already showing, navigate to content page
          if (isMedia && media) {
            startNavigation("media");
            router.push(`/media/${media.id}`);
          } else if (album) {
            startNavigation("album");
            router.push(`/albums/${album.id}`);
          }
        } else {
          // Actions are not showing, show them first
          e.preventDefault();
          e.stopPropagation();
          setShowMobileActions(true);
        }
        return;
      }

      // Default behavior: navigate to content page (desktop only)
      if (isMedia && media) {
        startNavigation("media");
        router.push(`/media/${media.id}`);
      } else if (album) {
        startNavigation("album");
        router.push(`/albums/${album.id}`);
      }
    }
  };

  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen();
    } else if (isMedia && media) {
      // Default behavior: open lightbox with proper index
      const lightboxMedia = getLightboxMedia();
      let index = 0;
      if (lightboxMedia.length > 1) {
        const foundIndex = lightboxMedia.findIndex((m) => m.id === media.id);
        index = foundIndex >= 0 ? foundIndex : currentIndex;
      }
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const handleAddToAlbum = useCallback(() => {
    if (onAddToAlbum) {
      onAddToAlbum();
    }
    if (isMedia && media) {
      // Check if user is authenticated before showing dialog
      if (!user) {
        // Redirect to login page with current page as return URL
        redirectToLogin();
        return;
      }

      // Default behavior: show add to album dialog for media items
      setAddToAlbumDialogOpen(true);
    }
  }, [onAddToAlbum, isMedia, media, user, redirectToLogin]);

  const handleConfirmRemove = async () => {
    if (onRemoveFromAlbum) {
      await onRemoveFromAlbum();
      setRemoveConfirmOpen(false);
    }
    if (isMedia && media && currentAlbumId) {
      try {
        await removeFromAlbumMutation.mutateAsync({
          albumId: currentAlbumId,
          mediaId: media.id,
        });
      } catch (error) {
        console.error("Failed to remove media from album:", error);
      } finally {
        setRemoveConfirmOpen(false);
      }
    } else {
      // For albums or other items, just log for now
      setRemoveConfirmOpen(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (onDownload) {
      onDownload();
    }
    if (isMedia && media) {
      // Default behavior: download the media file
      const mediaUrl = composeMediaUrl(media.url);
      const filename = media.originalFilename || media.filename;

      try {
        // Try using fetch + blob approach for better cross-browser compatibility
        const response = await fetch(mediaUrl);

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const blob = await response.blob();

        // Create object URL for the blob
        const blobUrl = URL.createObjectURL(blob);

        // Create temporary link and trigger download
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        link.style.display = "none";

        // Add to DOM, click, and clean up
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 100);
      } catch (error) {
        console.error(
          "Download failed with fetch, falling back to direct link:",
          error
        );

        // Fallback to direct link method
        const link = document.createElement("a");
        link.href = mediaUrl;
        link.download = filename;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [onDownload, isMedia, media]);

  const handleConfirmDelete = async () => {
    if (onDelete) {
      onDelete();
    }
    try {
      setDeleteConfirmOpen(false);
      if (isMedia && media) {
        // Default behavior: delete the media
        await deleteMediaMutation.mutateAsync(media.id);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  // Get the appropriate media list for lightbox
  const getLightboxMedia = (): Media[] => {
    if (mediaList && mediaList.length > 0) {
      return mediaList;
    } else if (isMedia && media) {
      return [media];
    }
    return [];
  };

  // Build custom actions array based on inActions prop
  const builtCustomActions = useMemo(() => {
    const actions = customActions ? [...customActions] : [];

    if (canAddToAlbum && inActions?.addToAlbum) {
      actions.push({
        label: "Add to Album",
        icon: <Plus className="h-4 w-4 text-gray-500" />,
        onClick: handleAddToAlbum,
      });
    }

    if (canRemoveFromAlbum && inActions?.removeFromAlbum) {
      actions.push({
        label: "Remove from Album",
        icon: <Minus className="h-4 w-4 text-red-500" />,
        onClick: () => setRemoveConfirmOpen(true),
        variant: "destructive" as const,
      });
    }

    if (canDownload && inActions?.download) {
      actions.push({
        label: "Download",
        icon: <Download className="h-4 w-4 text-gray-500" />,
        onClick: handleDownload,
      });
    }

    if (canDelete && inActions?.delete) {
      actions.push({
        label: "Delete",
        icon: <Trash2 className="h-4 w-4 text-red-500" />,
        onClick: () => setDeleteConfirmOpen(true),
        variant: "destructive" as const,
      });
    }

    return actions.length > 0 ? actions : undefined;
  }, [
    customActions,
    canAddToAlbum,
    canRemoveFromAlbum,
    canDownload,
    canDelete,
    inActions,
    handleAddToAlbum,
    handleDownload,
  ]);

  // Calculate dropdown position for portal
  const calculateDropdownPosition = useCallback(() => {
    if (!dropdownButtonRef.current) return;

    const buttonRect = dropdownButtonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Estimate dropdown dimensions
    const dropdownWidth = 200; // Approximate width
    const dropdownHeight = Math.min(
      240,
      (builtCustomActions?.length || 0) * 40 + 16
    ); // max-h-60 = 240px

    let top = buttonRect.bottom + 4; // mt-1 = 4px
    let left = buttonRect.right - dropdownWidth; // right-aligned

    // Adjust if dropdown would go below viewport
    if (top + dropdownHeight > viewportHeight) {
      top = buttonRect.top - dropdownHeight - 4;
    }

    // Adjust if dropdown would go outside left edge
    if (left < 8) {
      left = 8; // 8px padding from edge
    }

    // Adjust if dropdown would go outside right edge
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    setDropdownPosition({ top, left });
  }, [builtCustomActions?.length]);

  // Handle window events for portal dropdown positioning
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleWindowEvent = () => {
      if (dropdownOpen) {
        // Recalculate position on scroll/resize
        calculateDropdownPosition();
      }
    };

    window.addEventListener("scroll", handleWindowEvent, true);
    window.addEventListener("resize", handleWindowEvent);

    return () => {
      window.removeEventListener("scroll", handleWindowEvent, true);
      window.removeEventListener("resize", handleWindowEvent);
    };
  }, [dropdownOpen, calculateDropdownPosition]);

  // Handle dropdown toggle with position calculation
  const handleDropdownToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!dropdownOpen) {
        calculateDropdownPosition();
      }
      setDropdownOpen(!dropdownOpen);
    },
    [dropdownOpen, calculateDropdownPosition]
  );

  // PortalDropdown component
  const PortalDropdown = useMemo(() => {
    if (!dropdownOpen || !builtCustomActions || !dropdownPosition) return null;

    return createPortal(
      <div
        className="fixed min-w-max bg-card border border-border rounded-lg shadow-lg py-1 z-[9999] backdrop-blur-sm max-h-60 overflow-y-auto"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
        }}
        data-dropdown-content
      >
        {builtCustomActions.map((action, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              action.onClick();
              setDropdownOpen(false);
            }}
            className={cn(
              "w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors whitespace-nowrap h-[36px]",
              action.variant === "destructive"
                ? "text-red-500 hover:text-red-400 hover:bg-red-50"
                : "text-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                action.variant === "destructive"
                  ? "text-red-500"
                  : "text-muted-foreground"
              )}
            >
              {action.icon}
            </span>
            {action.label}
          </button>
        ))}
      </div>,
      document.body
    );
  }, [dropdownOpen, builtCustomActions, dropdownPosition]);

  return (
    <>
      <div
        ref={cardRef}
        data-content-card
        className={cn(
          "group relative cursor-pointer overflow-hidden shadow-lg transition-all duration-200 isolate",
          !useAllAvailableSpace && "rounded-lg sm:rounded-xl",
          !disableHoverEffects && !useAllAvailableSpace && "hover:shadow-xl",
          aspectRatio === "square" && !useAllAvailableSpace
            ? "aspect-square"
            : "",
          useAllAvailableSpace ? "w-full h-full" : "",
          className
        )}
        onClick={handleClick}
        onMouseEnter={() => !isMobileInterface && setIsHovered(true)}
        onMouseLeave={() => !isMobileInterface && setIsHovered(false)}
      >
        {/* Content based on type */}
        {isMedia && media ? (
          <div className="relative w-full h-full">
            {isVideoMedia ? (
              <video
                src={composeMediaUrl(media.url)}
                poster={composeMediaUrl(media.thumbnailUrl)}
                className={cn(
                  "w-full h-full",
                  useAllAvailableSpace ? "object-contain" : "object-cover",
                  imageClassName
                )}
                preload="metadata"
                muted
                playsInline
              />
            ) : (
              <ResponsivePicture
                thumbnailUrls={
                  preferredThumbnailSize
                    ? undefined
                    : composeThumbnailUrls(media.thumbnailUrls)
                }
                fallbackUrl={composeMediaUrl(
                  preferredThumbnailSize
                    ? media.thumbnailUrls?.[preferredThumbnailSize] ??
                        (media.thumbnailUrl || media.url)
                    : media.thumbnailUrl || media.url
                )}
                alt={title || media.originalFilename || media.filename}
                className={cn(
                  "w-full h-full transition-transform duration-200",
                  useAllAvailableSpace ? "object-contain" : "object-cover",
                  !disableHoverEffects &&
                    !useAllAvailableSpace &&
                    (isHovered || (isMobileInterface && showMobileActions)) &&
                    "scale-105",
                  imageClassName
                )}
                loading="lazy"
              />
            )}

            {/* Overlay */}
            <div
              className={cn(
                "absolute inset-0 transition-colors duration-300",
                isMobileInterface && showMobileActions
                  ? "bg-black/30"
                  : isHovered
                  ? "bg-black/20"
                  : "bg-black/0"
              )}
            />

            {/* Media overlay with gradient - only visible on hover/tap */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300",
                isMobileInterface
                  ? showMobileActions
                    ? "opacity-100"
                    : "opacity-0"
                  : isHovered
                  ? "opacity-100"
                  : "opacity-0"
              )}
            />

            {/* Play button for videos */}
            {isVideoMedia && (
              <div className="absolute inset-0 flex items-center justify-center">
                <PlayCircle
                  className={cn(
                    "w-16 h-16 text-white/80 transition-all duration-300",
                    isHovered ? "opacity-100 scale-110" : "opacity-50 scale-100"
                  )}
                />
              </div>
            )}

            {/* Right column - Action buttons over image */}
            <div
              className={cn(
                "absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex flex-col gap-1 sm:gap-2 transition-opacity duration-200",
                isMobileInterface
                  ? showMobileActions
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                  : isHovered
                  ? "opacity-100"
                  : "opacity-0"
              )}
            >
              {builtCustomActions && (
                <div className="relative">
                  <button
                    ref={dropdownButtonRef}
                    onClick={handleDropdownToggle}
                    className={cn(
                      "transition-opacity duration-200 w-8 h-8 p-0 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg flex items-center justify-center",
                      isMobileInterface
                        ? showMobileActions
                          ? "opacity-100"
                          : "opacity-0 pointer-events-none"
                        : isHovered
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                    aria-label="Content actions"
                  >
                    <MoreVertical className="h-4 w-4 text-white" />
                  </button>
                </div>
              )}
              {canFullscreen && (
                <Tooltip content="View fullscreen" side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFullscreen();
                    }}
                    className="p-2.5 sm:p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors shadow-lg hover:shadow-xl hover:scale-110"
                    aria-label="View fullscreen"
                  >
                    <Maximize2 className="h-4 w-4 sm:h-4 sm:w-4" />
                  </button>
                </Tooltip>
              )}
              {canAddToAlbum && !inActions?.addToAlbum && (
                <Tooltip content="Add to album" side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToAlbum();
                    }}
                    className="p-2.5 sm:p-2 rounded-lg bg-white/90 hover:bg-white text-gray-800 transition-colors shadow-lg hover:shadow-xl hover:scale-110"
                    aria-label="Add to album"
                  >
                    <Plus className="h-4 w-4 sm:h-4 sm:w-4" />
                  </button>
                </Tooltip>
              )}
              {canRemoveFromAlbum && !inActions?.removeFromAlbum && (
                <Tooltip content="Remove from album" side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemoveConfirmOpen(true);
                    }}
                    className="p-2.5 sm:p-2 rounded-lg bg-white/90 hover:bg-white text-red-600 transition-colors shadow-lg hover:shadow-xl hover:scale-110"
                    aria-label="Remove from album"
                  >
                    <Minus className="h-4 w-4 sm:h-4 sm:w-4" />
                  </button>
                </Tooltip>
              )}
              {canDownload && !inActions?.download && (
                <Tooltip content="Download" side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className="p-2.5 sm:p-2 rounded-lg bg-white/90 hover:bg-white text-gray-800 transition-colors shadow-lg hover:shadow-xl hover:scale-110"
                    aria-label="Download"
                  >
                    <Download className="h-4 w-4 sm:h-4 sm:w-4" />
                  </button>
                </Tooltip>
              )}
              {canDelete && !inActions?.delete && (
                <Tooltip content="Delete" side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmOpen(true);
                    }}
                    className="p-2.5 sm:p-2 rounded-lg bg-white/90 hover:bg-white text-red-600 transition-colors shadow-lg hover:shadow-xl hover:scale-110"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 sm:h-4 sm:w-4" />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Bottom content for media - exactly like albums */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center justify-between">
                {/* Empty space for alignment - could add media title here if needed */}
                <div></div>

                {/* Like, Bookmark, View count */}
                {showCounts && (
                  <div className="flex items-center gap-3">
                    {canBookmark && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "transition-opacity duration-200",
                          isMobileInterface
                            ? showMobileActions
                              ? "opacity-100"
                              : "opacity-0"
                            : isHovered
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      >
                        <BookmarkButton
                          targetType="media"
                          targetId={media.id}
                          size="sm"
                          className="text-white hover:text-blue-400 transition-colors duration-200"
                          showCount={false}
                        />
                      </div>
                    )}
                    {canLike && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "transition-opacity duration-200",
                          isMobileInterface
                            ? showMobileActions
                              ? "opacity-100"
                              : "opacity-0"
                            : isHovered
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      >
                        <LikeButton
                          targetType="media"
                          targetId={media.id}
                          size="sm"
                          className="text-white hover:text-red-400 transition-colors duration-200"
                          showCount={true}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-white text-sm">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <ViewCount
                        targetType="media"
                        targetId={media.id}
                        fallbackCount={media.viewCount ?? 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : album ? (
          <div className="relative w-full h-full">
            {!album.coverImageUrl &&
            (!album.thumbnailUrls ||
              Object.keys(album.thumbnailUrls).length === 0) &&
            (!album.contentPreview || album.contentPreview.length === 0) ? (
              <div className="flex items-center justify-center w-full h-full bg-muted/50">
                <Folder className="w-16 h-16 text-muted-foreground opacity-60" />
              </div>
            ) : (
              <ResponsivePicture
                thumbnailUrls={
                  preferredThumbnailSize
                    ? undefined
                    : composeThumbnailUrls(album.thumbnailUrls)
                }
                fallbackUrl={composeMediaUrl(
                  preferredThumbnailSize
                    ? album.thumbnailUrls?.[preferredThumbnailSize] ??
                        album.coverImageUrl
                    : album.coverImageUrl
                )}
                alt={title || album.title}
                className={cn(
                  "w-full h-full transition-transform duration-200",
                  useAllAvailableSpace ? "object-contain" : "object-cover",
                  !disableHoverEffects &&
                    !useAllAvailableSpace &&
                    (isHovered || (isMobileInterface && showMobileActions)) &&
                    "scale-105",
                  imageClassName
                )}
                loading="lazy"
                // Carousel props
                contentPreview={
                  album.contentPreview?.map(
                    composeThumbnailUrls
                  ) as ThumbnailUrls[]
                }
                enableCarousel={!!album.contentPreview}
                isHovered={isHovered}
                showMobileActions={showMobileActions}
                isMobileInterface={isMobileInterface}
              />
            )}

            {/* Album overlay with title */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-semibold text-sm line-clamp-2">
                {title || album.title}
              </h3>

              {/* Tags */}
              {showTags && album.tags && album.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {album.tags.slice(0, 3).map((tag, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const url = `/?tag=${encodeURIComponent(tag)}`;
                        router.push(url);
                      }}
                      className="transition-all duration-200 hover:scale-105"
                      title={`Filter by tag: ${tag}`}
                    >
                      <Tag
                        size="sm"
                        className="bg-white/20 text-white border-white/30 backdrop-blur-sm hover:bg-white/30 hover:border-white/50 transition-all duration-200"
                      >
                        {tag}
                      </Tag>
                    </button>
                  ))}
                  {album.tags.length > 3 && (
                    <span className="text-xs text-white/70 font-medium px-2 py-1">
                      +{album.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-1">
                <p className="text-white/80 text-xs">
                  {album.mediaCount ?? 0}{" "}
                  {album.mediaCount === 1 ? "item" : "items"}
                </p>
                {showCounts && (
                  <div className="flex items-center gap-3">
                    {canBookmark && !inActions?.bookmark && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "transition-opacity duration-200",
                          isMobileInterface
                            ? showMobileActions
                              ? "opacity-100"
                              : "opacity-0"
                            : isHovered
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      >
                        <BookmarkButton
                          targetType="album"
                          targetId={album.id}
                          size="sm"
                          className="text-white hover:text-blue-400 transition-colors duration-200"
                          showCount={false}
                        />
                      </div>
                    )}
                    {canLike && !inActions?.like && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "transition-opacity duration-200",
                          isMobileInterface
                            ? showMobileActions
                              ? "opacity-100"
                              : "opacity-0"
                            : isHovered
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      >
                        <LikeButton
                          targetType="album"
                          targetId={album.id}
                          size="sm"
                          className="text-white hover:text-red-400 transition-colors duration-200"
                          showCount={true}
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex items-center gap-1 text-white text-sm transition-opacity duration-200 opacity-100"
                      )}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <ViewCount
                        targetType="album"
                        targetId={album.id}
                        fallbackCount={album.viewCount || 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right column - Action buttons over image */}
            <div
              className={cn(
                "absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex flex-col gap-1 sm:gap-2 transition-opacity duration-200",
                isMobileInterface
                  ? showMobileActions
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                  : isHovered
                  ? "opacity-100"
                  : "opacity-0"
              )}
            >
              {builtCustomActions && (
                <div className="relative">
                  <button
                    ref={dropdownButtonRef}
                    onClick={handleDropdownToggle}
                    className={cn(
                      "transition-opacity duration-200 w-8 h-8 p-0 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg flex items-center justify-center",
                      isMobileInterface
                        ? showMobileActions
                          ? "opacity-100"
                          : "opacity-0 pointer-events-none"
                        : isHovered
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                    aria-label="Album actions"
                  >
                    <MoreVertical className="h-4 w-4 text-white" />
                  </button>
                </div>
              )}
              {canDelete && !inActions?.delete && (
                <Tooltip content="Delete" side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmOpen(true);
                    }}
                    className="p-2.5 sm:p-2 rounded-lg bg-white/90 hover:bg-white text-red-600 transition-colors shadow-lg hover:shadow-xl hover:scale-110"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 sm:h-4 sm:w-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Lightbox for fullscreen view */}
      {lightboxOpen && isMedia && media && (
        <Lightbox
          media={getLightboxMedia()}
          currentIndex={lightboxIndex}
          isOpen={lightboxOpen}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
          onClose={() => setLightboxOpen(false)}
          onNext={() => {
            const lightboxMedia = getLightboxMedia();
            if (lightboxIndex < lightboxMedia.length - 1 || hasNextPage) {
              setLightboxIndex(lightboxIndex + 1);
            }
          }}
          onPrevious={() => {
            if (lightboxIndex > 0) {
              setLightboxIndex(lightboxIndex - 1);
            }
          }}
        />
      )}

      {/* Add to Album Dialog */}
      {isMedia && media && addToAlbumDialogOpen && (
        <AddToAlbumDialog
          isOpen={addToAlbumDialogOpen}
          onClose={() => setAddToAlbumDialogOpen(false)}
          media={media}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Content"
        message={`Are you sure you want to delete this ${item.type}? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* Remove Media Confirmation Dialog */}
      <ConfirmDialog
        isOpen={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={handleConfirmRemove}
        title="Remove Media"
        message={`Are you sure you want to remove this media from the album? This action cannot be undone.`}
        confirmText="Remove"
        confirmVariant="danger"
      />

      {/* Portal Dropdown */}
      {PortalDropdown}
    </>
  );
}
