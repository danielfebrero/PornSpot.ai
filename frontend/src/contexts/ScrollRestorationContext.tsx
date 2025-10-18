"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  ReactNode,
} from "react";

interface ScrollPosition {
  scrollTop: number;
  topMostItemIndex: number;
  timestamp: number;
}

interface ScrollRestorationContextValue {
  saveScrollPosition: (key: string, position: ScrollPosition) => void;
  getScrollPosition: (key: string) => ScrollPosition | null;
  clearScrollPosition: (key: string) => void;
  hasStoredPosition: (key: string) => boolean;
}

const ScrollRestorationContext = createContext<
  ScrollRestorationContextValue | undefined
>(undefined);

interface ScrollRestorationProviderProps {
  children: ReactNode;
  /**
   * How long to keep scroll positions in memory (in ms)
   * Default: 5 minutes
   */
  maxAge?: number;
}

/**
 * Provider for scroll restoration context
 * Stores scroll positions in memory during component lifecycle
 * Positions are automatically cleaned up when expired
 */
export function ScrollRestorationProvider({
  children,
  maxAge = 5 * 60 * 1000, // 5 minutes
}: ScrollRestorationProviderProps) {
  const scrollPositionsRef = useRef<Map<string, ScrollPosition>>(new Map());
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * Save scroll position in memory
   */
  const saveScrollPosition = useCallback(
    (key: string, position: ScrollPosition) => {
      const positionWithTimestamp = {
        ...position,
        timestamp: Date.now(),
      };

      scrollPositionsRef.current.set(key, positionWithTimestamp);

      // Schedule cleanup of expired positions
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      cleanupTimeoutRef.current = setTimeout(() => {
        const now = Date.now();
        const positions = scrollPositionsRef.current;

        // Convert entries to array to avoid iterator issues
        const entries = Array.from(positions.entries());
        for (const [storageKey, storedPosition] of entries) {
          if (now - storedPosition.timestamp > maxAge) {
            positions.delete(storageKey);
          }
        }
      }, maxAge);
    },
    [maxAge]
  );

  /**
   * Get scroll position from memory
   */
  const getScrollPosition = useCallback(
    (key: string): ScrollPosition | null => {
      const position = scrollPositionsRef.current.get(key);

      if (!position) return null;

      // Check if position is too old
      if (Date.now() - position.timestamp > maxAge) {
        scrollPositionsRef.current.delete(key);
        return null;
      }

      return position;
    },
    [maxAge]
  );

  /**
   * Clear stored scroll position
   */
  const clearScrollPosition = useCallback((key: string) => {
    scrollPositionsRef.current.delete(key);
  }, []);

  /**
   * Check if there's a scroll position stored
   */
  const hasStoredPosition = useCallback(
    (key: string) => {
      return getScrollPosition(key) !== null;
    },
    [getScrollPosition]
  );

  const value: ScrollRestorationContextValue = {
    saveScrollPosition,
    getScrollPosition,
    clearScrollPosition,
    hasStoredPosition,
  };

  return (
    <ScrollRestorationContext.Provider value={value}>
      {children}
    </ScrollRestorationContext.Provider>
  );
}

/**
 * Hook to access scroll restoration context
 */
export function useScrollRestorationContext(): ScrollRestorationContextValue {
  const context = useContext(ScrollRestorationContext);

  if (context === undefined) {
    throw new Error(
      "useScrollRestorationContext must be used within a ScrollRestorationProvider"
    );
  }

  return context;
}
