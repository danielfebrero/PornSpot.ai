import { useState, useCallback, useRef } from "react";

interface UseTemporaryTooltipOptions {
  duration?: number; // Duration in milliseconds
}

export const useTemporaryTooltip = (
  options: UseTemporaryTooltipOptions = {}
) => {
  const { duration = 1000 } = options;
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsVisible(true);

    // Hide tooltip after specified duration
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, duration);
  }, [duration]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    isVisible,
    showTooltip,
    hideTooltip,
    cleanup,
  };
};
