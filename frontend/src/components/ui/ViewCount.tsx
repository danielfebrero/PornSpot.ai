"use client";

import { useViewCountsFromCache } from "@/hooks/queries/useViewCountsQuery";
import { useEffect, useState } from "react";

interface ViewCountProps {
  targetType: "album" | "image" | "video";
  targetId: string;
  fallbackCount?: number;
  className?: string;
}

export function ViewCount({
  targetType,
  targetId,
  fallbackCount = 0,
  className = "",
}: ViewCountProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true); // hydration will be true right after mount
  }, []);

  const targets = [{ targetType, targetId }];
  const { data } = useViewCountsFromCache(targets);
  const cachedCount = data?.viewCounts?.[0]?.viewCount;

  if (!isHydrated) {
    // 👇 Prevent React from rendering anything until hydration
    return null;
  }

  return (
    <span className={className}>
      {cachedCount !== undefined ? cachedCount : fallbackCount}
    </span>
  );
}
