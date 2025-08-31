"use client";

import { useRef, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

interface ScrollPosition {
  scrollTop: number;
  topMostItemIndex: number;
  timestamp: number;
}

interface UseScrollRestorationOptions {
  /**
   * Unique key to identify this scroll position storage
   * Should be unique per component instance/page
   */
  storageKey: string;

  /**
   * How long to keep scroll positions in storage (in ms)
   * Default: 5 minutes
   */
  maxAge?: number;

  /**
   * Debounce time for saving scroll position (in ms)
   * Default: 100ms
   */
  saveDebounceMs?: number;
}

/**
 * Hook for preserving and restoring scroll position across navigation
 * Uses sessionStorage to persist scroll state during browser session
 *
 * @example
 * ```tsx
 * const {
 *   saveScrollPosition,
 *   getInitialScrollState,
 *   clearScrollPosition
 * } = useScrollRestoration({
 *   storageKey: 'media-grid-scroll'
 * });
 *
 * // In Virtuoso component
 * <Virtuoso
 *   initialTopMostItemIndex={getInitialScrollState().topMostItemIndex}
 *   scrollSeekConfiguration={{
 *     enter: velocity => Math.abs(velocity) > 200,
 *     exit: velocity => Math.abs(velocity) < 30,
 *   }}
 *   rangeChanged={(range) => {
 *     saveScrollPosition({
 *       scrollTop: 0, // Not used for virtuoso
 *       topMostItemIndex: range.startIndex,
 *       timestamp: Date.now()
 *     });
 *   }}
 * />
 * ```
 */
export function useScrollRestoration({
  storageKey,
  maxAge = 5 * 60 * 1000, // 5 minutes
  saveDebounceMs = 100,
}: UseScrollRestorationOptions) {
  const pathname = usePathname();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedPositionRef = useRef<ScrollPosition | null>(null);

  // Create a unique storage key that includes pathname for context
  const fullStorageKey = `scroll-${storageKey}-${pathname}`;

  /**
   * Save scroll position to sessionStorage
   */
  const saveScrollPosition = useCallback(
    (position: ScrollPosition) => {
      // Debounce saves to avoid excessive storage writes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          // Only save if position has actually changed
          const lastPosition = lastSavedPositionRef.current;
          if (
            lastPosition &&
            lastPosition.topMostItemIndex === position.topMostItemIndex &&
            Math.abs(lastPosition.scrollTop - position.scrollTop) < 10
          ) {
            return;
          }

          const positionWithTimestamp = {
            ...position,
            timestamp: Date.now(),
          };

          sessionStorage.setItem(
            fullStorageKey,
            JSON.stringify(positionWithTimestamp)
          );
          lastSavedPositionRef.current = positionWithTimestamp;
        } catch (error) {
          // Silently handle storage errors (e.g., storage quota exceeded)
          console.warn("Failed to save scroll position:", error);
        }
      }, saveDebounceMs);
    },
    [fullStorageKey, saveDebounceMs]
  );

  /**
   * Get scroll position from sessionStorage
   */
  const getScrollPosition = useCallback((): ScrollPosition | null => {
    try {
      const stored = sessionStorage.getItem(fullStorageKey);
      if (!stored) return null;

      const position = JSON.parse(stored) as ScrollPosition;

      // Check if position is too old
      if (Date.now() - position.timestamp > maxAge) {
        sessionStorage.removeItem(fullStorageKey);
        return null;
      }

      return position;
    } catch (error) {
      // Handle invalid JSON or storage errors
      console.warn("Failed to retrieve scroll position:", error);
      return null;
    }
  }, [fullStorageKey, maxAge]);

  /**
   * Get initial scroll state for virtuoso component
   */
  const getInitialScrollState = useCallback(() => {
    const position = getScrollPosition();
    return {
      scrollTop: position?.scrollTop || 0,
      topMostItemIndex: position?.topMostItemIndex || 0,
      hasRestoredPosition: !!position,
    };
  }, [getScrollPosition]);

  /**
   * Clear stored scroll position
   */
  const clearScrollPosition = useCallback(() => {
    try {
      sessionStorage.removeItem(fullStorageKey);
      lastSavedPositionRef.current = null;
    } catch (error) {
      console.warn("Failed to clear scroll position:", error);
    }
  }, [fullStorageKey]);

  /**
   * Check if there's a scroll position to restore
   */
  const hasStoredPosition = useCallback(() => {
    return getScrollPosition() !== null;
  }, [getScrollPosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-cleanup old scroll positions from other components
  useEffect(() => {
    const cleanupOldPositions = () => {
      try {
        const keysToRemove: string[] = [];
        const now = Date.now();

        // Check all keys in sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("scroll-")) {
            try {
              const value = sessionStorage.getItem(key);
              if (value) {
                const position = JSON.parse(value) as ScrollPosition;
                if (now - position.timestamp > maxAge) {
                  keysToRemove.push(key);
                }
              }
            } catch {
              // Invalid JSON, mark for removal
              keysToRemove.push(key);
            }
          }
        }

        // Remove expired entries
        keysToRemove.forEach((key) => {
          try {
            sessionStorage.removeItem(key);
          } catch {
            // Ignore errors during cleanup
          }
        });
      } catch (error) {
        console.warn("Failed to cleanup old scroll positions:", error);
      }
    };

    // Run cleanup on mount and then periodically
    cleanupOldPositions();
    const interval = setInterval(cleanupOldPositions, 60000); // Every minute

    return () => clearInterval(interval);
  }, [maxAge]);

  return {
    saveScrollPosition,
    getScrollPosition,
    getInitialScrollState,
    clearScrollPosition,
    hasStoredPosition,
  };
}
