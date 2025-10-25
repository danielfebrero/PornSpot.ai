import { ApiUtil } from "../api-util";
import {
  LeaderboardUserEntry,
  GetPSCLeaderboardRequest,
  ApiKeyedPaginatedResponse,
  UnifiedLeaderboardResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

// Leaderboard API response type
export type GetPSCLeaderboardResponse = ApiKeyedPaginatedResponse<
  "users",
  LeaderboardUserEntry
>;

// Extended request type to support SSG/ISR fetch options
export interface GetPSCLeaderboardRequestWithOptions
  extends GetPSCLeaderboardRequest {
  fetchOptions?: RequestInit;
}

// Leaderboard API Functions
export const leaderboardApi = {
  /**
   * Get PSC leaderboard - top users by total PSC earned
   * @param params - limit and cursor for pagination, plus optional fetchOptions for ISR
   * @returns Paginated list of top PSC earners
   */
  getPSCLeaderboard: async (
    params?: GetPSCLeaderboardRequestWithOptions
  ): Promise<UnifiedLeaderboardResponse> => {
    const queryParams: Record<string, string> = {};

    if (params?.limit) {
      queryParams.limit = params.limit.toString();
    }

    if (params?.cursor) {
      queryParams.cursor = params.cursor;
    }

    const response = await ApiUtil.get<UnifiedLeaderboardResponse>(
      "/leaderboard/psc",
      queryParams,
      params?.fetchOptions
    );

    return ApiUtil.extractData(response);
  },
};
