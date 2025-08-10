"use client";

import { useTranslations } from "next-intl";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useInteractionStatusFromCache,
  useToggleBookmark,
} from "@/hooks/queries/useInteractionsQuery";
import { useUserProfile } from "@/hooks/queries/useUserQuery";
import { InteractionButtonSkeleton } from "@/components/ui/Skeleton";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  targetType: "album" | "media";
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
  const { data: userProfile } = useUserProfile();
  const user = userProfile?.user || null;
  const { redirectToLogin } = useAuthRedirect();

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
      // Redirect to login page with current page as return URL
      redirectToLogin();
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

      {showCount && bookmarkCount > 0 && (
        <span className={cn("font-medium text-gray-600", config.text)}>
          {bookmarkCount.toLocaleString()}
        </span>
      )}
    </div>
  );
};
