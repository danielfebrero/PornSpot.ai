"use client";

import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useInteractionStatusFromCache,
  useToggleLike,
} from "@/hooks/queries/useInteractionsQuery";
import { InteractionButtonSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useUserContext } from "@/contexts/UserContext";
import { TemporaryTooltip } from "@/components/ui/TemporaryTooltip";
import { useTemporaryTooltip } from "@/hooks/useTemporaryTooltip";
import { useEffect } from "react";

interface LikeButtonProps {
  targetType: "album" | "media";
  targetId: string;
  albumId?: string; // Required for media interactions
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "outline";
  className?: string;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
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
  const tUser = useTranslations("user.likes");

  // Use TanStack Query hooks for interaction status and toggle
  const targets = [{ targetType, targetId }];
  // Use cache-only to avoid refetching (parent fetches in bulk)
  const { data: interactionData, isLoading } =
    useInteractionStatusFromCache(targets);
  const { mutateAsync: toggleLikeMutation, isPending: isToggling } =
    useToggleLike();

  // Extract status from query data
  const currentStatus = interactionData?.statuses?.[0];
  const isLiked = currentStatus?.userLiked ?? false;

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  const likeCount = currentStatus?.likeCount ?? 0;

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

  const handleLike = async () => {
    if (!user) {
      // Show temporary tooltip before redirecting
      showTooltip();
      return;
    }

    try {
      // Use TanStack Query mutation with optimistic updates built-in
      await toggleLikeMutation({
        targetType,
        targetId,
        albumId,
        isCurrentlyLiked: isLiked,
      });
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {user && isLoading ? (
        <InteractionButtonSkeleton size={size} className={className} />
      ) : (
        <TemporaryTooltip
          content={tUser("loginToLike")}
          isVisible={tooltipVisible}
          position="top"
        >
          <Button
            variant={variant}
            size="icon"
            onClick={handleLike}
            disabled={isToggling}
            className={cn(
              config.button,
              "transition-colors duration-200 hover:bg-transparent",
              isLiked && "text-red-500 hover:text-red-600",
              !isLiked && "text-gray-500 hover:text-red-500",
              className
            )}
            title={
              !user
                ? tUser("loginToLike")
                : isLiked
                ? tUser("removeLike")
                : t("like")
            }
          >
            <Heart
              className={cn(
                config.icon,
                "transition-all duration-200",
                isLiked && "fill-current"
              )}
            />
          </Button>
        </TemporaryTooltip>
      )}

      {showCount && likeCount > 0 && (
        <span className={cn("font-medium", config.text)}>
          {likeCount.toLocaleString()}
        </span>
      )}
    </div>
  );
};
