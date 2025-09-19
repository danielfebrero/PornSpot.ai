"use client";

import { useEffect } from "react";
import { useTrackView } from "@/hooks/queries/useViewCountsQuery";

interface ViewTrackerProps {
  targetType: "album" | "image" | "video" | "profile";
  targetId: string;
}

import { useRef } from "react";

export const ViewTracker: React.FC<ViewTrackerProps> = ({
  targetType,
  targetId,
}) => {
  const hasTracked = useRef(false);
  const trackViewMutation = useTrackView();

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
