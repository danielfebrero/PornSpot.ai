import { useQuery } from "@tanstack/react-query";
import { interactionApi } from "@/lib/api";
import { UnifiedUserInteractionsResponse } from "@/types/user";
import { UserInteraction } from "@/types";

// Types
interface UseProfileDataOptions {
  username?: string;
  isOwner?: boolean;
  limit?: number;
  enabled?: boolean;
  includeContentPreview?: boolean;
}

interface ProfileData {
  recentLikes: UserInteraction[];
}

// Hook for fetching profile data including recent likes and statistics
export function useProfileDataQuery(options: UseProfileDataOptions) {
  const {
    username,
    isOwner = false,
    limit = 3,
    enabled = true,
    includeContentPreview = false,
  } = options;

  return useQuery({
    queryKey: ["profile", "data", username, isOwner, limit],
    queryFn: async (): Promise<ProfileData> => {
      if (!username && !isOwner) {
        return { recentLikes: [] };
      }

      const response = await interactionApi.getLikes({
        username,
        limit,
        includeContentPreview,
      });

      return {
        recentLikes: response.interactions,
      };
    },
    enabled: enabled && (!!username || isOwner),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
