import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { MinimalUser } from "@shared";

const handleGetFollowing = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("👥 /user/following handler called");

  // Only allow GET method
  if (event.httpMethod !== "GET") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  // Get username from query parameters
  const username = event.queryStringParameters?.["username"];
  if (!username) {
    console.log("❌ Missing username parameter");
    return ResponseUtil.badRequest(event, "Username parameter is required");
  }

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.follow,
      MAX_PAGINATION_LIMITS.follow
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  console.log("👥 Getting following for user:", { username, limit });

  try {
    // Validate username
    const validatedUsername = ValidationUtil.validateRequiredString(
      username,
      "username"
    );

    // Get the user by username
    const user = await DynamoDBService.getUserByUsername(validatedUsername);
    if (!user) {
      console.log("❌ User not found:", validatedUsername);
      return ResponseUtil.notFound(event, "User not found");
    }

    // Get following relationships
    const followingResult = await DynamoDBService.getUserFollowing(
      user.userId,
      limit,
      lastEvaluatedKey
    );

    // Get the actual user data for each followed user
    const followingUsers: MinimalUser[] = [];
    for (const follow of followingResult.follows) {
      const followedUser = await DynamoDBService.getUserById(follow.followedId);
      if (followedUser && followedUser.isActive) {
        const minimalUser: MinimalUser = {
          userId: followedUser.userId,
          username: followedUser.username,
          ...(followedUser.avatarUrl && { avatarUrl: followedUser.avatarUrl }),
          ...(followedUser.avatarThumbnails && {
            avatarThumbnails: {
              originalSize: followedUser.avatarThumbnails.originalSize,
              small: followedUser.avatarThumbnails.small,
              medium: followedUser.avatarThumbnails.medium,
              large: followedUser.avatarThumbnails.large,
            },
          }),
        };
        followingUsers.push(minimalUser);
      }
    }

    console.log(
      `✅ Found ${followingUsers.length} following for user: ${username}`
    );

    // Build typed paginated payload
    const payload = PaginationUtil.createPaginatedResponse(
      "following",
      followingUsers,
      followingResult.lastEvaluatedKey,
      limit
    );

    return ResponseUtil.success(event, payload);
  } catch (error) {
    console.error("❌ Error getting following:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to get following"
    );
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetFollowing);
