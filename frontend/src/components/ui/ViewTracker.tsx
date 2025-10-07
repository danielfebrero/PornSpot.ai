"use client";

import { useEffect, useRef } from "react";
import {
  primeViewCountCache,
  useTrackView,
} from "@/hooks/queries/useViewCountsQuery";

interface ViewTrackerProps {
  targetType: "album" | "image" | "video" | "profile";
  targetId: string;
  initialViewCount?: number | null;
}

export const ViewTracker: React.FC<ViewTrackerProps> = ({
  targetType,
  targetId,
  initialViewCount,
}) => {
  const hasTracked = useRef(false);
  const trackViewMutation = useTrackView();

  useEffect(() => {
    if (
      initialViewCount == null ||
      (targetType !== "album" &&
        targetType !== "image" &&
        targetType !== "video")
    ) {
      return;
    }

    primeViewCountCache(targetType, targetId, initialViewCount);
  }, [initialViewCount, targetId, targetType]);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    // Track view when component mounts (page load)
    trackViewMutation.mutate({
      targetType,
      targetId,
    });
  }, [targetType, targetId, trackViewMutation]);

  return null; // This component doesn't render anything
};
