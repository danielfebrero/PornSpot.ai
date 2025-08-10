"use client";

import { useState, useCallback } from "react";
import { PanInfo } from "framer-motion";

interface SwipeGestureConfig {
  swipeThreshold?: number;
  velocityThreshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enablePreview?: boolean;
}

interface SwipeState {
  isDragging: boolean;
  dragOffset: number;
  direction: "left" | "right" | null;
}

// Framer Motion event type for pan handlers
type MotionEvent = MouseEvent | TouchEvent | PointerEvent;

/**
 * Hook for handling swipe gestures in the Lightbox
 * Provides smooth swipe detection with preview functionality
 */
export function useSwipeGesture({
  swipeThreshold = 100,
  velocityThreshold = 300,
  onSwipeLeft,
  onSwipeRight,
  enablePreview = true,
}: SwipeGestureConfig) {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isDragging: false,
    dragOffset: 0,
    direction: null,
  });

  const handleDragStart = useCallback(() => {
    setSwipeState((prev) => ({
      ...prev,
      isDragging: true,
      direction: null,
    }));
  }, []);

  const handleDrag = useCallback(
    (event: MotionEvent, info: PanInfo) => {
      const offset = info.offset.x;
      let direction: "left" | "right" | null = null;

      // Determine direction based on drag distance
      if (enablePreview && Math.abs(offset) > 50) {
        direction = offset > 0 ? "right" : "left";
      }

      setSwipeState((prev) => ({
        ...prev,
        dragOffset: offset,
        direction,
      }));
    },
    [enablePreview]
  );

  const handleDragEnd = useCallback(
    (event: MotionEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const shouldTriggerSwipe =
        Math.abs(offset.x) > swipeThreshold ||
        Math.abs(velocity.x) > velocityThreshold;

      if (shouldTriggerSwipe) {
        if (offset.x > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (offset.x < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }

      // Reset state
      setSwipeState({
        isDragging: false,
        dragOffset: 0,
        direction: null,
      });
    },
    [swipeThreshold, velocityThreshold, onSwipeLeft, onSwipeRight]
  );

  const resetSwipe = useCallback(() => {
    setSwipeState({
      isDragging: false,
      dragOffset: 0,
      direction: null,
    });
  }, []);

  return {
    swipeState,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    resetSwipe,
    isDragging: swipeState.isDragging,
    dragOffset: swipeState.dragOffset,
    direction: swipeState.direction,
  };
}
