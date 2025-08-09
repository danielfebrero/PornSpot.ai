/*
File objective: List public albums with optional tag filter and profile views.
Auth: Public endpoint; supports anonymous and authenticated users (no difference in visibility unless querying own data elsewhere).
Special notes:
- Supports username-based profile filter (?user=username) and tag filter (?tag=)
- Cursor-based pagination via PaginationUtil and DynamoDB GSIs
- Ensures only public albums are returned in public/profile contexts
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { UserAuthUtil } from "@shared/utils/user-auth";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * Albums GET endpoint with intelligent filtering based on user permissions:
 *
 * Authentication: Optional - supports both authenticated and anonymous requests
 * - Authenticated users: userId available from authorizer context or session validation
 * - Anonymous users: currentUserId is null, only public content accessible
 *
 * Logic:
 * - If user parameter is provided: always show only public albums (public profile view)
 * - If no user is provided: all public albums from everyone
 *
 * - Queries are DynamoDB-native with proper pagination using LastEvaluatedKey cursors
 * - No in-memory filtering or offset logic for optimal performance
 * - Tag filtering is applied server-side when supported by the query method
 * - Supports user (username) parameter for profile views
 *
 * ⚠️ All album items MUST have the 'isPublic' attribute for the GSI to work properly.
 *   If some don't, a backfill is required to set this field on all items.
 */

const handleGetAlbums = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Extract user authentication with anonymous access allowed
  // This endpoint supports both authenticated and anonymous requests
  const authResult = await UserAuthUtil.allowAnonymous(event);

  // Handle error response from authentication (should not happen with allowAnonymous)
  if (UserAuthUtil.isErrorResponse(authResult)) {
    return authResult;
  }

  const currentUserId = authResult.userId; // Can be null for anonymous users

  if (currentUserId) {
    console.log("✅ Authenticated user:", currentUserId);
  } else {
    console.log("ℹ️ Anonymous user - proceeding with public content only");
  }

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.albums,
      MAX_PAGINATION_LIMITS.albums
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  const isPublicParam = event.queryStringParameters?.["isPublic"];
  const tag = event.queryStringParameters?.["tag"]; // Tag filter parameter
  const userParam = event.queryStringParameters?.["user"]; // User parameter for username lookup

  console.log("[Albums API] Request params:", {
    limit,
    isPublicParam,
    tag,
    userParam,
    cursor: lastEvaluatedKey ? "present" : "none",
  });

  // Handle user parameter lookup
  let finalCreatedBy = undefined;
  if (userParam) {
    console.log("[Albums API] Looking up user by username:", userParam);
    // Look up the target user by username
    const targetUser = await DynamoDBService.getUserByUsername(userParam);
    console.log(
      "[Albums API] Target user lookup result:",
      targetUser
        ? { userId: targetUser.userId, username: targetUser.username }
        : null
    );

    if (!targetUser) {
      console.log("[Albums API] User not found for username:", userParam);
      return ResponseUtil.notFound(event, "User not found");
    }
    finalCreatedBy = targetUser.userId;
    console.log("[Albums API] Resolved username to userId:", finalCreatedBy);
  }

  let result;

  // Implement the new logic based on user requirements
  if (finalCreatedBy) {
    console.log("[Albums API] Using finalCreatedBy:", finalCreatedBy);

    // Public profile view - always show only public albums
    console.log(
      "[Albums API] Public profile view - fetching albums by creator"
    );
    result = await DynamoDBService.listAlbumsByCreator(
      finalCreatedBy,
      limit,
      lastEvaluatedKey,
      tag
    );
    console.log("[Albums API] Raw albums from DB:", result.albums?.length || 0);

    // Filter to only show public albums if finalCreatedBy !== currentUserId
    if (finalCreatedBy !== currentUserId || isPublicParam) {
      result.albums = result.albums.filter((album) => album.isPublic === true);
      console.log(
        "[Albums API] Public albums after filtering:",
        result.albums?.length || 0
      );
    }
  } else {
    // No user provided - show all public albums from everyone
    result = await DynamoDBService.listAlbumsByPublicStatus(
      true, // Only public albums
      limit,
      lastEvaluatedKey,
      tag
    );
  }

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "albums",
    result.albums,
    result.lastEvaluatedKey,
    limit
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetAlbums);
