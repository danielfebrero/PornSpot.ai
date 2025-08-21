"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface AdvancedGestureConfig {
  swipeThreshold?: number;
  velocityThreshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enablePreview?: boolean;
}

interface GestureState {
  isDragging: boolean;
  dragOffset: number;
  direction: "left" | "right" | null;
  isZooming: boolean;
  isPinching: boolean;
}

interface TouchData {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

/**
 * Advanced gesture hook that handles both swipe navigation and pinch-to-zoom
 * Uses native touch events to detect multi-touch gestures and single-touch swipes
 */
export function useAdvancedGestures({
  swipeThreshold = 100,
  velocityThreshold = 300,
  onSwipeLeft,
  onSwipeRight,
  enablePreview = true,
}: AdvancedGestureConfig) {
  const [gestureState, setGestureState] = useState<GestureState>({
    isDragging: false,
    dragOffset: 0,
    direction: null,
    isZooming: false,
    isPinching: false,
  });

  const touchData = useRef<TouchData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    // If multiple touches detected, it's likely a pinch gesture
    if (event.touches.length > 1) {
      setGestureState((prev) => ({
        ...prev,
        isPinching: true,
        isDragging: false,
      }));
      return;
    }

    // Single touch - potential swipe
    const touch = event.touches[0];
    touchData.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
    };

    setGestureState((prev) => ({
      ...prev,
      isDragging: true,
      isPinching: false,
      direction: null,
    }));
  }, []);

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      // If pinching or multiple touches, allow native zoom behavior
      if (event.touches.length > 1 || gestureState.isPinching) {
        setGestureState((prev) => ({
          ...prev,
          isPinching: true,
          isDragging: false,
        }));
        return;
      }

      // Single touch movement - handle swipe
      if (!touchData.current || !gestureState.isDragging) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - touchData.current.startX;
      const deltaY = touch.clientY - touchData.current.startY;

      // Update current position
      touchData.current.currentX = touch.clientX;
      touchData.current.currentY = touch.clientY;

      // Check if this is more of a vertical scroll than horizontal swipe
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        // More vertical than horizontal - allow native scroll
        setGestureState((prev) => ({
          ...prev,
          isDragging: false,
          dragOffset: 0,
          direction: null,
        }));
        return;
      }

      // Prevent default only for horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        event.preventDefault();
      }

      let direction: "left" | "right" | null = null;
      if (enablePreview && Math.abs(deltaX) > 50) {
        direction = deltaX > 0 ? "right" : "left";
      }

      setGestureState((prev) => ({
        ...prev,
        dragOffset: deltaX,
        direction,
      }));
    },
    [gestureState.isDragging, gestureState.isPinching, enablePreview]
  );

  const handleTouchEnd = useCallback(() => {
    // If was pinching, reset state
    if (gestureState.isPinching) {
      setGestureState((prev) => ({
        ...prev,
        isPinching: false,
        isDragging: false,
        dragOffset: 0,
        direction: null,
      }));
      return;
    }

    // Handle swipe completion
    if (!touchData.current || !gestureState.isDragging) return;

    const deltaX = touchData.current.currentX - touchData.current.startX;
    const deltaTime = Date.now() - touchData.current.startTime;
    const velocity = (Math.abs(deltaX) / deltaTime) * 1000; // pixels per second

    const shouldTriggerSwipe =
      Math.abs(deltaX) > swipeThreshold || velocity > velocityThreshold;

    if (shouldTriggerSwipe) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    // Reset state
    setGestureState({
      isDragging: false,
      dragOffset: 0,
      direction: null,
      isZooming: false,
      isPinching: false,
    });
    touchData.current = null;
  }, [
    gestureState.isDragging,
    gestureState.isPinching,
    swipeThreshold,
    velocityThreshold,
    onSwipeLeft,
    onSwipeRight,
  ]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const resetGesture = useCallback(() => {
    setGestureState({
      isDragging: false,
      dragOffset: 0,
      direction: null,
      isZooming: false,
      isPinching: false,
    });
    touchData.current = null;
  }, []);

  return {
    containerRef,
    gestureState,
    resetGesture,
    isDragging: gestureState.isDragging,
    dragOffset: gestureState.dragOffset,
    direction: gestureState.direction,
    isZooming: gestureState.isZooming,
    isPinching: gestureState.isPinching,
  };
}
