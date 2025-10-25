/**
 * @fileoverview PSC Leaderboard Handler
 * @description Retrieves top users by total PSC earned using GSI5
 * @auth Public endpoint - no authentication required
 * @queryParams {number} limit - Number of users to return (default 50, max 100)
 * @queryParams {string} cursor - Pagination cursor (base64 encoded)
 * @notes
 * - Queries GSI5 (USER_PSC_TOTAL_EARNED) in descending order
 * - Returns user rankings with position, username, avatar, and score (PSC earned)
 * - Pagination support for large leaderboards
 * - Public data only - no sensitive information exposed
 * - Uses PaginationUtil for standardized cursor-based pagination
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { LeaderboardUserEntry } from "@shared";

/**
 * Parse GSI5SK to extract PSC total earned
 * Format: {pscTotalEarned}#{userId} (zero-padded to 23 chars)
 */
function parsePSCFromGSI5SK(gsi5sk?: string): number {
  if (!gsi5sk) return 0;
  const parts = gsi5sk.split("#");
  if (parts.length < 1) return 0;
  return parseFloat(parts[0] || "0") || 0;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🏆 /leaderboard/psc handler called");

  // Handle OPTIONS for CORS
  if (event.httpMethod === "OPTIONS") {
    return ResponseUtil.noContent(event);
  }

  // Only allow GET method
  if (event.httpMethod !== "GET") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  try {
    // Parse pagination parameters using unified utility
    let paginationParams;
    try {
      paginationParams = PaginationUtil.parseRequestParams(
        event.queryStringParameters as Record<string, string> | null,
        DEFAULT_PAGINATION_LIMITS.leaderboards || 25,
        MAX_PAGINATION_LIMITS.leaderboards || 100
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Invalid pagination parameters";
      return ResponseUtil.badRequest(event, errorMessage);
    }

    const { cursor: lastEvaluatedKey, limit } = paginationParams;

    console.log("🔍 Querying GSI5 for top PSC earners (limit:", limit, ")");

    // Use DynamoDBService to get leaderboard
    const result = await DynamoDBService.getPSCLeaderboard(
      limit,
      lastEvaluatedKey
    );

    console.log("✅ Query returned", result.users.length, "users");

    // Transform results to leaderboard entries
    const users: LeaderboardUserEntry[] = result.users.map((user, index) => {
      const score = parsePSCFromGSI5SK(user.GSI5SK);

      return {
        rank: index + 1,
        userId: user.userId || "",
        username: user.username || "Anonymous",
        avatarUrl: user.avatarUrl,
        avatarThumbnails: user.avatarThumbnails,
        score: score,
      };
    });

    // Build typed paginated payload using PaginationUtil
    const payload = PaginationUtil.createPaginatedResponse(
      "users",
      users,
      result.lastEvaluatedKey,
      limit
    );

    console.log(
      "🏆 Returning",
      users.length,
      "leaderboard entries, hasNext:",
      payload?.pagination?.hasNext || false
    );

    return ResponseUtil.success(event, payload);
  } catch (error) {
    console.error("❌ Error fetching PSC leaderboard:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to fetch leaderboard"
    );
  }
};
