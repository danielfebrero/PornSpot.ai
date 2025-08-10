"use client";

import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useInteractionStatusFromCache,
  useToggleLike,
} from "@/hooks/queries/useInteractionsQuery";
import { useUserProfile } from "@/hooks/queries/useUserQuery";
import { InteractionButtonSkeleton } from "@/components/ui/Skeleton";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { cn } from "@/lib/utils";

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
  const { data: userProfile } = useUserProfile();
  const user = userProfile?.user || null;
  const { redirectToLogin } = useAuthRedirect();

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
      // Redirect to login page with current page as return URL
      redirectToLogin();
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
        <Button
          variant={variant}
          size="icon"
          onClick={handleLike}
          disabled={isToggling || !user}
          className={cn(
            config.button,
            "transition-colors duration-200",
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
      )}

      {showCount && likeCount > 0 && (
        <span className={cn("font-medium", config.text)}>
          {likeCount.toLocaleString()}
        </span>
      )}
    </div>
  );
};
