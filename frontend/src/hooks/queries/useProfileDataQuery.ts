import { useQuery } from "@tanstack/react-query";
import { interactionApi } from "@/lib/api";
import { UnifiedUserInteractionsResponse, UserInteraction } from "@/types/user";

// Types
interface UseProfileDataOptions {
  username?: string;
  isOwner?: boolean;
  limit?: number;
  enabled?: boolean;
}

interface ProfileData {
  recentLikes: UserInteraction[];
}

// Hook for fetching profile data including recent likes and statistics
export function useProfileDataQuery(options: UseProfileDataOptions) {
  const { username, isOwner = false, limit = 3, enabled = true } = options;

  return useQuery({
    queryKey: ["profile", "data", username, isOwner, limit],
    queryFn: async (): Promise<ProfileData> => {
      if (!username && !isOwner) {
        return { recentLikes: [] };
      }

      let response: UnifiedUserInteractionsResponse;

      if (username) {
        // Fetch likes for specific user by username
        response = await interactionApi.getLikesByUsername(username, limit);
      } else {
        // Fetch current user's likes (for owner view)
        response = await interactionApi.getLikes(limit);
      }

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch profile data");
      }

      return {
        recentLikes: response.data?.interactions,
      };
    },
    enabled: enabled && (!!username || isOwner),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
