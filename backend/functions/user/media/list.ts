/**
 * @fileoverview User Media Listing Handler
 * @description Retrieves paginated list of user's media, optionally for a specific user by username (public only).
 * @auth Requires authentication via LambdaHandlerUtil.withAuth.
 * @queryParams username (optional for public profile); limit, cursor (pagination).
 * @notes
 * - Validates username if provided, fetches user, checks active.
 * - Fetches media for current or target user; publicOnly if username provided.
 * - Converts entities to Media format.
 * - Unified pagination response.
 * - Logs user and publicOnly flag.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { Media } from "@shared";

const handleListUserMedia = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const currentUserId = auth.userId;
  console.log("✅ Authenticated user:", currentUserId);

  // Check if we're looking up a specific user by username
  const username = event.queryStringParameters?.["username"];
  let targetUserId = currentUserId; // Default to current user

  if (username) {
    console.log("🔍 Looking up user by username:", username);

    // Get user by username
    const userEntity = await DynamoDBService.getUserByUsername(username);
    if (!userEntity) {
      console.log("❌ User not found with username:", username);
      return ResponseUtil.notFound(event, "User not found");
    }

    // Check if user is active
    if (!userEntity.isActive) {
      console.log("❌ User is inactive:", username);
      return ResponseUtil.notFound(event, "User not found");
    }

    targetUserId = userEntity.userId;
    console.log("✅ Found user:", targetUserId, userEntity.email);
  }

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.media,
      MAX_PAGINATION_LIMITS.media
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  // Determine if we should only fetch public media
  const publicOnly = !!username;

  console.log(
    "🔍 Fetching media for userId:",
    targetUserId,
    "publicOnly:",
    publicOnly
  );

  // Optional type filtering (image|video)
  const typeParam = event.queryStringParameters?.["type"];
  let mimeTypePrefix: string | undefined;
  if (typeParam === "image") mimeTypePrefix = "image/";
  else if (typeParam === "video") mimeTypePrefix = "video/";

  // Get user's media (current user or target user)
  const { media, nextKey } = await DynamoDBService.getUserMedia(
    targetUserId,
    limit,
    lastEvaluatedKey,
    publicOnly,
    mimeTypePrefix
  );

  // Convert MediaEntity to Media using shared helper
  const mediaResponse: Media[] = media.map((item) =>
    DynamoDBService.convertMediaEntityToMedia(item)
  );

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "media",
    mediaResponse,
    nextKey,
    limit
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withAuth(handleListUserMedia);
