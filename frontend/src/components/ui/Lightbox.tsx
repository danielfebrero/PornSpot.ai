import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Media } from "@/types/index";
import { cn, isVideo } from "@/lib/utils";
import { ContentCard } from "@/components/ui/ContentCard";
import { MediaPlayer } from "@/components/ui/MediaPlayer";
import { ViewTracker } from "@/components/ui//ViewTracker";
import { useLightboxPreloader } from "@/hooks/useLightboxPreloader";
import { useAdvancedGestures } from "@/hooks/useAdvancedGestures";
import { useSleepPrevention } from "@/hooks/useSleepPrevention";

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
  onGoToIndex?: (index: number) => void;
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
  onGoToIndex,
  onDelete,
}) => {
  const t = useTranslations("ui.lightbox");

  const [isMounted, setIsMounted] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState(3000); // Default 3 seconds
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sleep prevention for slideshow
  const { enableSleepPrevention, disableSleepPrevention } =
    useSleepPrevention();

  const currentMedia = media[currentIndex];
  const nextMedia = media[currentIndex + 1];
  const prevMedia = media[currentIndex - 1];

  // Determine if current media is video
  const isVideoMedia = isVideo(currentMedia);

  // Use optimized preloader for seamless navigation
  const { preloadAroundIndex } = useLightboxPreloader(media, currentIndex);

  // Slideshow functionality - auto advance to next media
  useEffect(() => {
    if (!isSlideshow || !isOpen || media.length <= 1) return;

    const interval = setInterval(() => {
      // Check if we can advance to next media
      if (currentIndex < media.length - 1) {
        setIsPlayingVideo(false); // Stop video when navigating
        onNext();
      } else if (hasNextPage) {
        setIsPlayingVideo(false); // Stop video when navigating
        onNext();
      } else {
        // Reached the end
        if (isLoop && onGoToIndex) {
          // Loop back to the beginning cleanly
          setIsPlayingVideo(false);
          onGoToIndex(0);
        } else {
          // Stop slideshow at the end
          setIsSlideshow(false);
        }
      }
    }, slideshowInterval);

    return () => clearInterval(interval);
  }, [
    isSlideshow,
    isOpen,
    currentIndex,
    media.length,
    hasNextPage,
    slideshowInterval,
    isLoop,
    onNext,
    onGoToIndex,
  ]);

  // Sleep prevention effect - prevent device sleep during slideshow
  useEffect(() => {
    if (isSlideshow && isOpen) {
      // Enable sleep prevention when slideshow starts
      enableSleepPrevention();
    } else {
      // Disable sleep prevention when slideshow stops or lightbox closes
      disableSleepPrevention();
    }

    // Cleanup on unmount
    return () => {
      disableSleepPrevention();
    };
  }, [isSlideshow, isOpen, enableSleepPrevention, disableSleepPrevention]);

  // Wrapped navigation functions that stop slideshow when manually navigating
  const handleNext = useCallback(() => {
    setIsSlideshow(false); // Stop slideshow on manual navigation
    setIsPlayingVideo(false); // Stop video when navigating

    // Show controls for manual navigation
    setAreControlsVisible(true);

    // Clear any existing timeout
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Set timeout to hide controls
    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, 3000);

    onNext();
  }, [onNext]);

  const handlePrevious = useCallback(() => {
    setIsSlideshow(false); // Stop slideshow on manual navigation
    setIsPlayingVideo(false); // Stop video when navigating

    // Show controls for manual navigation
    setAreControlsVisible(true);

    // Clear any existing timeout
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Set timeout to hide controls
    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, 3000);

    onPrevious();
  }, [onPrevious]);

  // Handle advanced gestures with preview and zoom support
  const { containerRef, dragOffset, isPinching } = useAdvancedGestures({
    // Swiping left should navigate to the NEXT item (content moves left)
    onSwipeLeft: () => {
      if (currentIndex < media.length - 1 || hasNextPage) {
        handleNext();
      }
    },
    // Swiping right should navigate to the PREVIOUS item (content moves right)
    onSwipeRight: () => {
      if (currentIndex > 0) {
        handlePrevious();
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
      // Use a small timeout to debounce rapid navigation
      const timeoutId = setTimeout(() => {
        onLoadMore();
      }, 100);

      return () => clearTimeout(timeoutId);
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
            handlePrevious();
          }
          break;
        case "ArrowRight":
          if (currentIndex < media.length - 1 || hasNextPage) {
            handleNext();
          }
          break;
        case " ": // Spacebar to toggle slideshow
          event.preventDefault();
          setIsSlideshow(!isSlideshow);
          break;
      }
    },
    [
      isOpen,
      handleClose,
      handleNext,
      handlePrevious,
      currentIndex,
      media.length,
      hasNextPage,
      isSlideshow,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle browser back button to close lightbox
  useEffect(() => {
    if (!isOpen) return;

    // Track if we've already added a history state to avoid duplicates
    let historyAdded = false;

    // Add a dummy history entry when lightbox opens (only once)
    if (!window.history.state?.lightbox) {
      window.history.pushState({ lightbox: true }, "", window.location.href);
      historyAdded = true;
    }

    const handlePopState = () => {
      // Use the current onClose directly to avoid stale closure
      onClose();
    };

    // Listen for popstate events (back button)
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Only clean up history if we added it in this effect
      if (historyAdded && window.history.state?.lightbox) {
        // Don't call history.back() in cleanup as it might interfere with normal navigation
        // Let the handleClose in the component handle history cleanup when needed
      }
    };
  }, [isOpen, onClose]);

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

  const handleMouseMove = useCallback(() => {
    // Only on desktop (non-touch devices)
    if (!window.matchMedia("(pointer: coarse)").matches) {
      setAreControlsVisible(true);

      // Clear existing timeout
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      // Set new timeout to hide controls
      const timeout = setTimeout(() => {
        setAreControlsVisible(false);
      }, 3000);

      hideControlsTimeoutRef.current = timeout;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    // Only on mobile (touch devices)
    if (window.matchMedia("(pointer: coarse)").matches) {
      setAreControlsVisible(true);

      // Clear existing timeout
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      // Set new timeout to hide controls
      const timeout = setTimeout(() => {
        setAreControlsVisible(false);
      }, 3000);

      hideControlsTimeoutRef.current = timeout;
    }
  }, []);

  // Set up mouse/touch event listeners for auto-hide
  useEffect(() => {
    if (!isOpen) return;

    // Show controls initially when lightbox opens
    setAreControlsVisible(true);

    // Clear any existing timeout
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Set timeout to hide controls
    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, 3000);

    // Add event listeners
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchstart", handleTouchStart);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchstart", handleTouchStart);

      // Clear timeout on cleanup
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isOpen, handleMouseMove, handleTouchStart]);

  // Reset controls visibility when slideshow state changes (but not during auto-navigation)
  useEffect(() => {
    if (isOpen && !isSlideshow) {
      // Only show controls when slideshow is stopped or when slideshow state changes
      setAreControlsVisible(true);

      // Clear any existing timeout
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      // Set timeout to hide controls
      hideControlsTimeoutRef.current = setTimeout(() => {
        setAreControlsVisible(false);
      }, 3000);
    }
  }, [isSlideshow, isLoop, isOpen]); // Removed currentIndex to prevent showing controls during auto-navigation

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
        {/* Swipeable Media Content with deck-of-cards layered images and zoom support */}
        <div
          ref={containerRef}
          className="w-full h-full flex items-center justify-center overflow-hidden"
          style={{
            touchAction: isPinching ? "auto" : "pan-y pinch-zoom",
          }}
        >
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

            {/* Current Media - on top, with advanced gesture support */}
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
                x: dragOffset,
                scale: 1,
              }}
              transition={{
                duration: 0,
              }}
              style={{
                zIndex: 10,
              }}
            >
              <div
                className="w-fit h-fit max-w-full max-h-full"
                data-testid="lightbox-image"
                style={{
                  touchAction: "pinch-zoom",
                }}
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
                    showCounts={true}
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
          aria-label={t("close")}
          data-testid="lightbox-close"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: areControlsVisible ? 1 : 0,
            scale: areControlsVisible ? 1 : 0.8,
          }}
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
                  handlePrevious();
                }
              }}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-20",
                currentIndex === 0
                  ? "opacity-30 cursor-not-allowed"
                  : "cursor-pointer hover:scale-110"
              )}
              aria-label={t("previousMedia")}
              data-testid="lightbox-prev"
              disabled={currentIndex === 0}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: areControlsVisible
                  ? currentIndex === 0
                    ? 0.3
                    : 1
                  : 0,
                x: 0,
              }}
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
                  handleNext();
                }
              }}
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-20",
                currentIndex === media.length - 1 && !hasNextPage
                  ? "opacity-30 cursor-not-allowed"
                  : "cursor-pointer hover:scale-110"
              )}
              aria-label={t("nextMedia")}
              data-testid="lightbox-next"
              disabled={currentIndex === media.length - 1 && !hasNextPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{
                opacity: areControlsVisible
                  ? currentIndex === media.length - 1 && !hasNextPage
                    ? 0.3
                    : 1
                  : 0,
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

        {/* Mobile Swipe Indicator & Slideshow Controls */}
        {media.length > 1 && (
          <motion.div
            className="absolute bottom-4 left-1/2 z-20 md:hidden"
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{
              opacity: areControlsVisible ? 1 : 0,
              y: areControlsVisible ? 0 : 20,
              x: "-50%",
            }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex flex-col items-center gap-3">
              {/* Swipe Indicator */}
              <div className="text-white/60 text-sm">
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
                  <span>{t("swipeToNavigate")}</span>
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
              </div>

              {/* Mobile Slideshow Controls */}
              <div className="bg-black/70 text-white rounded-lg p-2 backdrop-blur-sm border border-white/20 flex items-center gap-2">
                {/* Compact Interval Selector */}
                <select
                  value={slideshowInterval}
                  onChange={(e) => setSlideshowInterval(Number(e.target.value))}
                  className="bg-black/50 text-white border border-white/30 rounded px-1 py-1 text-xs focus:outline-none focus:border-white/60"
                  aria-label={t("slideshowInterval")}
                >
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                </select>

                {/* Compact Play/Stop Button */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSlideshow(!isSlideshow);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  aria-label={
                    isSlideshow ? t("stopSlideshow") : t("playSlideshow")
                  }
                  data-testid="slideshow-toggle-mobile"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSlideshow ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </motion.button>

                {/* Compact Loop Button */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLoop(!isLoop);
                  }}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isLoop
                      ? "bg-blue-600/70 hover:bg-blue-600/90 text-white"
                      : "hover:bg-white/10 text-white"
                  }`}
                  aria-label={isLoop ? t("disableLoop") : t("enableLoop")}
                  data-testid="slideshow-loop-mobile"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Slideshow Controls */}
        {media.length > 1 && (
          <motion.div
            className="absolute bottom-4 left-1/2 bg-black/70 text-white rounded-lg p-3 z-30 backdrop-blur-sm border border-white/20 hidden md:flex items-center gap-3"
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{
              opacity: areControlsVisible ? 1 : 0,
              y: areControlsVisible ? 0 : 20,
              x: "-50%",
            }}
            transition={{ delay: 0.4 }}
          >
            {/* Interval Selector */}
            <select
              value={slideshowInterval}
              onChange={(e) => setSlideshowInterval(Number(e.target.value))}
              className="bg-black/50 text-white border border-white/30 rounded px-2 py-1 text-sm focus:outline-none focus:border-white/60"
              aria-label={t("slideshowInterval")}
            >
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>

            {/* Play/Stop Button */}
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setIsSlideshow(!isSlideshow);
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer flex items-center gap-2"
              aria-label={isSlideshow ? t("stopSlideshow") : t("playSlideshow")}
              data-testid="slideshow-toggle"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSlideshow ? (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  <span className="text-sm">{t("stop")}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="text-sm">{t("play")}</span>
                </>
              )}
            </motion.button>

            {/* Loop Button */}
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setIsLoop(!isLoop);
              }}
              className={`p-2 rounded-full transition-colors cursor-pointer flex items-center gap-2 ${
                isLoop
                  ? "bg-blue-600/70 hover:bg-blue-600/90 text-white"
                  : "hover:bg-white/10 text-white"
              }`}
              aria-label={isLoop ? t("disableLoop") : t("enableLoop")}
              data-testid="slideshow-loop"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-5 h-5"
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
              <span className="text-sm">{t("loop")}</span>
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>,
    document.body
  );
};
