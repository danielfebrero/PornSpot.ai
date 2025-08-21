import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Media } from "@/types/index";
import { cn, isVideo } from "@/lib/utils";
import { ContentCard } from "@/components/ui/ContentCard";
import { MediaPlayer } from "@/components/ui/MediaPlayer";
import { ViewTracker } from "@/components/ui//ViewTracker";
import { useLightboxPreloader } from "@/hooks/useLightboxPreloader";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

interface LightboxProps {
  media: Media[];
  currentIndex: number;
  isOpen: boolean;

  canDelete?: boolean;

  // Infinite scroll support
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;

  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete?: (mediaId: string) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  media,
  currentIndex,
  isOpen,
  canDelete = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onClose,
  onNext,
  onPrevious,
  onDelete,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const currentMedia = media[currentIndex];
  const nextMedia = media[currentIndex + 1];
  const prevMedia = media[currentIndex - 1];

  // Determine if current media is video
  const isVideoMedia = isVideo(currentMedia);

  // Use optimized preloader for seamless navigation
  const { preloadAroundIndex } = useLightboxPreloader(media, currentIndex);

  // Handle swipe gestures with preview
  const { handleDragStart, handleDrag, handleDragEnd, dragOffset } =
    useSwipeGesture({
      // Swiping left should navigate to the NEXT item (content moves left)
      onSwipeLeft: () => {
        if (currentIndex < media.length - 1 || hasNextPage) {
          setIsPlayingVideo(false); // Stop video when navigating
          onNext();
        }
      },
      // Swiping right should navigate to the PREVIOUS item (content moves right)
      onSwipeRight: () => {
        if (currentIndex > 0) {
          setIsPlayingVideo(false); // Stop video when navigating
          onPrevious();
        }
      },
      enablePreview: true,
    });

  // Trigger preloading when lightbox opens or index changes
  useEffect(() => {
    if (isOpen && media.length > 0) {
      preloadAroundIndex(currentIndex);
    }
  }, [isOpen, currentIndex, media.length, preloadAroundIndex]);

  // Trigger loading more content when approaching the end
  useEffect(() => {
    if (
      isOpen &&
      hasNextPage &&
      !isFetchingNextPage &&
      onLoadMore &&
      currentIndex >= media.length - 3 // Load more when 3 items from the end
    ) {
      onLoadMore();
    }
  }, [
    isOpen,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    currentIndex,
    media.length,
  ]);

  // Reset video playing state when current media changes
  useEffect(() => {
    setIsPlayingVideo(false);
  }, [currentIndex]);

  // Reset video playing state when lightbox is closed
  useEffect(() => {
    if (!isOpen) {
      setIsPlayingVideo(false);
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the backdrop itself is clicked
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Initialize mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Wrap onClose to handle history cleanup
  const handleClose = useCallback(() => {
    // If we have a lightbox history state, go back to remove it
    if (window.history.state?.lightbox) {
      window.history.back();
    }
    // Call the original onClose
    onClose();
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          if (currentIndex > 0) {
            setIsPlayingVideo(false); // Stop video when navigating
            onPrevious();
          }
          break;
        case "ArrowRight":
          if (currentIndex < media.length - 1 || hasNextPage) {
            setIsPlayingVideo(false); // Stop video when navigating
            onNext();
          }
          break;
      }
    },
    [
      isOpen,
      handleClose,
      onNext,
      onPrevious,
      currentIndex,
      media.length,
      hasNextPage,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle browser back button to close lightbox
  useEffect(() => {
    const handlePopState = () => {
      if (isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      // Add a dummy history entry when lightbox opens
      window.history.pushState({ lightbox: true }, "", window.location.href);

      // Listen for popstate events (back button)
      window.addEventListener("popstate", handlePopState);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !currentMedia || !isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black"
      onClick={handleBackdropClick}
      data-testid="lightbox"
    >
      {/* View Tracker - Track view when media is displayed */}
      {currentMedia && (
        <ViewTracker
          key={currentMedia.id}
          targetType="media"
          targetId={currentMedia.id}
        />
      )}

      {/* Content wrapper */}
      <div className="relative w-full h-full">
        {/* Swipeable Media Content with deck-of-cards layered images */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full max-w-[100vw] max-h-[100vh] flex">
            {/* Background Card Stack - Multiple layers for depth */}
            {/* Layer 3 (deepest) - 2 items ahead/behind */}
            {(media[currentIndex + 2] || media[currentIndex - 2]) && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  zIndex: 1,
                  transform: "scale(0.85) translateY(12px)",
                  opacity: 0.3,
                }}
              >
                <div className="w-fit h-fit max-w-full max-h-full">
                  <ContentCard
                    item={media[currentIndex + 2] || media[currentIndex - 2]}
                    aspectRatio="auto"
                    className="bg-transparent shadow-none border-none w-fit h-fit"
                    imageClassName="max-w-[calc(100vw)] max-h-[calc(100vh)] w-auto h-auto object-contain"
                    canLike={false}
                    canBookmark={false}
                    canFullscreen={false}
                    canAddToAlbum={false}
                    canDownload={false}
                    canDelete={false}
                    showCounts={false}
                    disableHoverEffects={true}
                    preferredThumbnailSize="originalSize"
                    useAllAvailableSpace={true}
                    onClick={() => {}}
                  />
                </div>
              </div>
            )}

            {/* Layer 2 (middle) - Previous media when swiping right */}
            {prevMedia && (
              <motion.div
                key={`prev-${prevMedia.id}`}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  zIndex: dragOffset > 0 ? 5 : 2,
                }}
                animate={{
                  scale: 1,
                  y: 0,
                  opacity: dragOffset > 0 ? 1 : 0,
                }}
                transition={{ type: "tween", duration: 0.1 }}
              >
                <div className="w-fit h-fit max-w-full max-h-full">
                  <ContentCard
                    item={prevMedia}
                    aspectRatio="auto"
                    className="bg-transparent shadow-none border-none w-fit h-fit"
                    imageClassName="max-w-[calc(100vw)] max-h-[calc(100vh)] w-auto h-auto object-contain"
                    canLike={false}
                    canBookmark={false}
                    canFullscreen={false}
                    canAddToAlbum={false}
                    canDownload={false}
                    canDelete={false}
                    showCounts={false}
                    disableHoverEffects={true}
                    preferredThumbnailSize="originalSize"
                    useAllAvailableSpace={true}
                    onClick={() => {}}
                  />
                </div>
              </motion.div>
            )}

            {/* Layer 2 (middle) - Next media when swiping left */}
            {nextMedia && (
              <motion.div
                key={`next-${nextMedia.id}`}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  zIndex: dragOffset < 0 ? 5 : 2,
                }}
                animate={{
                  scale: 1,
                  y: 0,
                  opacity: dragOffset < 0 ? 1 : 0,
                }}
                transition={{ type: "tween", duration: 0.1 }}
              >
                <div className="w-fit h-fit max-w-full max-h-full">
                  <ContentCard
                    item={nextMedia}
                    aspectRatio="auto"
                    className="bg-transparent shadow-none border-none w-fit h-fit"
                    imageClassName="max-w-[calc(100vw)] max-h-[calc(100vh)] w-auto h-auto object-contain"
                    canLike={false}
                    canBookmark={false}
                    canFullscreen={false}
                    canAddToAlbum={false}
                    canDownload={false}
                    canDelete={false}
                    showCounts={false}
                    disableHoverEffects={true}
                    preferredThumbnailSize="originalSize"
                    useAllAvailableSpace={true}
                    onClick={() => {}}
                  />
                </div>
              </motion.div>
            )}

            {/* Current Media - on top, draggable */}
            <motion.div
              key={`current-${currentIndex}`}
              className="absolute inset-0 flex items-center justify-center"
              initial={{
                opacity: 1,
                x: 0,
                scale: 1,
              }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
              }}
              transition={{
                duration: 0,
              }}
              drag="x"
              dragConstraints={{ left: -600, right: 600 }}
              dragElastic={0.5}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              style={{
                x: dragOffset,
                zIndex: 10,
              }}
            >
              <div
                className="w-fit h-fit max-w-full max-h-full"
                data-testid="lightbox-image"
              >
                {isVideoMedia ? (
                  <MediaPlayer
                    media={currentMedia}
                    isPlaying={isPlayingVideo}
                    onTogglePlay={() => setIsPlayingVideo(!isPlayingVideo)}
                    onMobileClick={() => setIsPlayingVideo(!isPlayingVideo)}
                    className="bg-transparent shadow-none border-none w-fit h-fit"
                    imageClassName="max-w-[calc(100vw)] max-h-[calc(100vh)] w-auto h-auto object-contain"
                    canFullscreen={false}
                  />
                ) : (
                  <ContentCard
                    item={currentMedia}
                    aspectRatio="auto"
                    className="bg-transparent shadow-none border-none w-fit h-fit"
                    imageClassName="max-w-[calc(100vw)] max-h-[calc(100vh)] w-auto h-auto object-contain"
                    canLike={true}
                    canBookmark={true}
                    canFullscreen={false}
                    canAddToAlbum={true}
                    canDownload={true}
                    canDelete={canDelete}
                    onDelete={() => {
                      onDelete!(currentMedia.id);
                    }}
                    showCounts={false}
                    disableHoverEffects={true}
                    preferredThumbnailSize="originalSize"
                    useAllAvailableSpace={true}
                    onClick={() => {}}
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Media Counter */}
        {media.length > 1 && (
          <motion.div
            className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm font-medium z-30 backdrop-blur-sm border border-white/20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <span>
                {currentIndex + 1} of{" "}
                {hasNextPage ? `${media.length}+` : media.length}
              </span>
              {isFetchingNextPage && (
                <div className="animate-spin">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Close Button */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white z-20"
          aria-label="Close"
          data-testid="lightbox-close"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </motion.button>

        {/* Navigation Arrows - Enhanced for mobile */}
        {media.length > 1 && (
          <>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex > 0) {
                  setIsPlayingVideo(false); // Stop video when navigating
                  onPrevious();
                }
              }}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-20",
                currentIndex === 0
                  ? "opacity-30 cursor-not-allowed"
                  : "cursor-pointer hover:scale-110"
              )}
              aria-label="Previous media"
              data-testid="lightbox-prev"
              disabled={currentIndex === 0}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: currentIndex === 0 ? 0.3 : 1, x: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={currentIndex > 0 ? { scale: 1.1 } : {}}
              whileTap={currentIndex > 0 ? { scale: 0.9 } : {}}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </motion.button>

            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex < media.length - 1 || hasNextPage) {
                  setIsPlayingVideo(false); // Stop video when navigating
                  onNext();
                }
              }}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-20",
                currentIndex === media.length - 1 && !hasNextPage
                  ? "opacity-30 cursor-not-allowed"
                  : "cursor-pointer hover:scale-110"
              )}
              aria-label="Next media"
              data-testid="lightbox-next"
              disabled={currentIndex === media.length - 1 && !hasNextPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{
                opacity:
                  currentIndex === media.length - 1 && !hasNextPage ? 0.3 : 1,
                x: 0,
              }}
              transition={{ delay: 0.3 }}
              whileHover={
                currentIndex < media.length - 1 || hasNextPage
                  ? { scale: 1.1 }
                  : {}
              }
              whileTap={
                currentIndex < media.length - 1 || hasNextPage
                  ? { scale: 0.9 }
                  : {}
              }
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </motion.button>
          </>
        )}

        {/* Mobile Swipe Indicator */}
        {media.length > 1 && (
          <motion.div
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm z-20 md:hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16l-4-4m0 0l4-4m-4 4h18"
                />
              </svg>
              <span>Swipe to navigate</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </div>
          </motion.div>
        )}
      </div>
    </div>,
    document.body
  );
};
