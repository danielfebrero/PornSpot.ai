"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useInteractions } from "@/hooks/useInteractions";
import { useUser } from "@/hooks/useUser";
import { useTargetInteractionStatus } from "@/hooks/useUserInteractionStatus";
import { InteractionButtonSkeleton } from "@/components/ui/Skeleton";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  targetType: "album" | "media";
  targetId: string;
  albumId?: string; // Required for media interactions
  initialBookmarked?: boolean;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "outline";
  className?: string;
  useCache?: boolean; // If true, only use cache (don't make individual API calls)
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  targetType,
  targetId,
  albumId,
  initialBookmarked = false,
  showCount = false,
  size = "md",
  variant = "ghost",
  className,
  useCache = false,
}) => {
  const { user } = useUser();
  const { toggleBookmark, isToggling, error } = useInteractions();
  const { userBookmarked, isLoading, updateStatusOptimistically } =
    useTargetInteractionStatus(targetType, targetId, { useCache });
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(null);
  const { redirectToLogin } = useAuthRedirect();

  const t = useTranslations("common");
  const tUser = useTranslations("user.bookmarks");

  // Use the cached status instead of local state
  const isBookmarked = user ? userBookmarked : initialBookmarked;

  // Size configurations
  const sizeConfig = {
    sm: {
      button: "h-8 w-8 p-0",
      icon: "h-4 w-4",
      text: "text-xs",
    },
    md: {
      button: "h-10 w-10 p-0",
      icon: "h-5 w-5",
      text: "text-sm",
    },
    lg: {
      button: "h-12 w-12 p-0",
      icon: "h-6 w-6",
      text: "text-base",
    },
  };

  const config = sizeConfig[size];

  const handleBookmark = async () => {
    if (!user) {
      // Redirect to login page with current page as return URL
      redirectToLogin();
      return;
    }

    const newBookmarkedState = !isBookmarked;

    try {
      // Update status optimistically first
      updateStatusOptimistically({ userBookmarked: newBookmarkedState });

      // Update count optimistically
      if (bookmarkCount !== null) {
        setBookmarkCount(
          newBookmarkedState ? bookmarkCount + 1 : bookmarkCount - 1
        );
      }

      await toggleBookmark(targetType, targetId, albumId, isBookmarked);
    } catch (err) {
      // Revert optimistic update on error
      updateStatusOptimistically({ userBookmarked: isBookmarked });
      if (bookmarkCount !== null) {
        setBookmarkCount(isBookmarked ? bookmarkCount + 1 : bookmarkCount - 1);
      }
      console.error("Failed to toggle bookmark:", err);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {user && isLoading ? (
        <InteractionButtonSkeleton size={size} className={className} />
      ) : (
        <Button
          variant={variant}
          size="icon"
          onClick={handleBookmark}
          disabled={isToggling || !user}
          className={cn(
            config.button,
            "transition-colors duration-200",
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
      )}

      {showCount && bookmarkCount !== null && (
        <span className={cn("font-medium text-gray-600", config.text)}>
          {bookmarkCount.toLocaleString()}
        </span>
      )}

      {error && (
        <span className="text-xs text-red-500 ml-2">{t("failedToUpdate")}</span>
      )}
    </div>
  );
};
