"use client";

import { useTranslations } from "next-intl";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useInteractionStatusFromCache,
  useToggleBookmark,
} from "@/hooks/queries/useInteractionsQuery";
import { InteractionButtonSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/contexts/UserContext";
import { TemporaryTooltip } from "@/components/ui/TemporaryTooltip";
import { useTemporaryTooltip } from "@/hooks/useTemporaryTooltip";
import { useEffect } from "react";

interface BookmarkButtonProps {
  targetType: "album" | "image" | "video";
  targetId: string;
  albumId?: string; // Required for media interactions
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  targetType,
  targetId,
  albumId,
  showCount = false,
  size = "md",
  variant = "ghost",
  className,
}) => {
  const { user } = useUserContext();
  const {
    isVisible: tooltipVisible,
    showTooltip,
    cleanup,
  } = useTemporaryTooltip({
    duration: 1000,
  });

  const t = useTranslations("common");
  const tUser = useTranslations("user.bookmarks");

  // Use TanStack Query hooks for interaction status and toggle (cache-only)
  const targets = [{ targetType, targetId }];
  const { data: interactionData, isLoading } =
    useInteractionStatusFromCache(targets);
  const { mutateAsync: toggleBookmarkMutation, isPending: isToggling } =
    useToggleBookmark();

  // Extract status from query data
  const currentStatus = interactionData?.statuses?.[0];
  const isBookmarked = currentStatus?.userBookmarked ?? false;
  const bookmarkCount = currentStatus?.bookmarkCount ?? 0;

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Size configurations
  const sizeConfig = {
    sm: {
      button: "h-8 w-fit p-0",
      icon: "h-4 w-4",
      text: "text-xs",
    },
    md: {
      button: "h-10 w-fit p-0",
      icon: "h-5 w-5",
      text: "text-sm",
    },
    lg: {
      button: "h-12 w-fit p-0",
      icon: "h-6 w-6",
      text: "text-base",
    },
  };

  const config = sizeConfig[size];

  const handleBookmark = async () => {
    if (!user) {
      // Show temporary tooltip before redirecting
      showTooltip();
      return;
    }

    try {
      // Use TanStack Query mutation with optimistic updates built-in
      await toggleBookmarkMutation({
        targetType,
        targetId,
        albumId,
        isCurrentlyBookmarked: isBookmarked,
      });
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {user && isLoading ? (
        <InteractionButtonSkeleton size={size} className={className} />
      ) : (
        <TemporaryTooltip
          content={tUser("loginToBookmark")}
          isVisible={tooltipVisible}
          position="top"
        >
          <Button
            variant={variant}
            size="icon"
            onClick={handleBookmark}
            disabled={isToggling}
            className={cn(
              config.button,
              "transition-colors duration-200 hover:bg-transparent",
              isBookmarked && "text-blue-500 hover:text-blue-600",
              !isBookmarked && "text-gray-500 hover:text-blue-500",
              className
            )}
            title={
              !user
                ? tUser("loginToBookmark")
                : isBookmarked
                ? tUser("removeBookmark")
                : t("bookmark")
            }
          >
            <Bookmark
              className={cn(
                config.icon,
                "transition-all duration-200",
                isBookmarked && "fill-current"
              )}
            />
          </Button>
        </TemporaryTooltip>
      )}

      {showCount && bookmarkCount > 0 && (
        <span className={cn("font-medium text-gray-600", config.text)}>
          {bookmarkCount.toLocaleString()}
        </span>
      )}
    </div>
  );
};
