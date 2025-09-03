"use client";

import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Compass, Heart, Users } from "lucide-react";

export type SortMode = "discover" | "popular" | "following";

interface SortTabsProps {
  className?: string;
}

export function SortTabs({ className }: SortTabsProps) {
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const t = useTranslations("discover");

  const urlSort = (searchParams.get("sort") as SortMode) || "discover";
  const currentTag = searchParams.get("tag");

  // Optimistic state for immediate UI updates
  const [optimisticSort, setOptimisticSort] = useState<SortMode>(urlSort);

  // Sync optimistic state with URL when it changes
  useEffect(() => {
    setOptimisticSort(urlSort);
  }, [urlSort]);

  // Use optimistic state for UI, fallback to URL state
  const currentSort = optimisticSort;

  const handleSortChange = (sortMode: SortMode) => {
    // Immediately update optimistic state for instant UI feedback
    setOptimisticSort(sortMode);

    const params = new URLSearchParams(searchParams.toString());

    if (sortMode === "discover") {
      // Remove sort param for discover (default)
      params.delete("sort");
    } else {
      params.set("sort", sortMode);
    }

    // Preserve tag filter if present
    const queryString = params.toString();
    const path = queryString ? `/?${queryString}` : "/";

    router.push(path);
  };

  const handleRemoveTag = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag");

    // Preserve sort parameter if present
    const queryString = params.toString();
    const path = queryString ? `/?${queryString}` : "/";

    router.push(path);
  };

  const tabs = [
    {
      id: "discover" as const,
      label: t("discover"),
      icon: Compass,
    },
    {
      id: "popular" as const,
      label: t("popular"),
      icon: Heart,
    },
    {
      id: "following" as const,
      label: t("following"),
      icon: Users,
    },
  ];

  return (
    <div className={cn("flex flex-row items-center gap-2 mb-6", className)}>
      {/* Tab Navigation */}
      <div className="bg-card/50 backdrop-blur-sm border border-admin-primary/10 rounded-lg p-1 shadow-sm">
        <div className="flex bg-background/50 rounded-md p-0.5">
          {tabs.map((tab) => {
            const isActive = currentSort === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleSortChange(tab.id)}
                className={cn(
                  "relative flex items-center justify-center px-3 py-1.5 rounded text-xs font-medium transition-all duration-300 ease-out",
                  "min-w-[80px] group",
                  isActive
                    ? "bg-gradient-to-r from-admin-primary to-admin-secondary text-admin-primary-foreground shadow-md transform scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-admin-primary/5 hover:scale-[1.01]"
                )}
              >
                {/* Background glow effect for active tab */}
                {isActive && (
                  <div className="absolute inset-0 rounded bg-gradient-to-r from-admin-primary/20 to-admin-secondary/20 blur-sm -z-10" />
                )}

                {/* Icon */}
                <span
                  className={cn(
                    "transition-transform duration-300 mr-1.5",
                    isActive ? "scale-110" : "group-hover:scale-105"
                  )}
                >
                  {<tab.icon className="h-4 w-4" />}
                </span>

                {/* Label */}
                <span className="font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Enhanced tag indicator with tag-like design */}
      {currentTag && (
        <div className="relative flex items-center flex-shrink min-w-0">
          {/* Tag shape with arrow notch */}
          <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full pl-3 pr-4 py-1.5 shadow-md max-w-[120px] flex items-center">
            {/* Tag content */}
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="text-xs font-medium truncate" title={currentTag}>
                {currentTag}
              </span>
            </div>

            {/* Remove button */}
            <button
              onClick={handleRemoveTag}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-all duration-200 hover:scale-110 group flex-shrink-0"
              title="Remove tag filter"
            >
              <svg
                className="w-2.5 h-2.5 group-hover:rotate-90 transition-transform duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
