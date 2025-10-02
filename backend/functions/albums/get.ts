/**
 * @fileoverview Public Albums Listing Handler
 * @description Lists public albums with filtering by tag or user profile, supporting pagination and anonymous access.
 * @auth Public endpoint via LambdaHandlerUtil.withoutAuth (allows anonymous).
 * @queryParams limit, cursor (pagination); tag (filter); user (username for profile); includeMediaIds, includeContentPreview (optional expansions).
 * @notes
 * - Resolves username to userId for profile views, shows only public albums.
 * - No user param: lists all public albums.
 * - Uses GSIs for efficient querying (public status, by creator).
 * - Applies server-side tag filtering where supported.
 * - Optionally expands with mediaIds or contentPreview (first few media items).
 * - Filters to public only for non-owner views.
 * - Unified pagination response format.
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
import { Album } from "@shared";

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
  const includeMediaIds =
    event.queryStringParameters?.["includeMediaIds"] === "true"; // Include media IDs in response
  const includeContentPreview =
    event.queryStringParameters?.["includeContentPreview"] === "true"; // Include content preview in response

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
      tag,
      !!(isPublicParam || finalCreatedBy !== currentUserId)
    );
    console.log("[Albums API] Raw albums from DB:", result.albums?.length || 0);
  } else {
    // No user provided - show all public albums from everyone
    result = await DynamoDBService.listAlbumsByPublicStatus(
      true, // Only public albums
      limit,
      lastEvaluatedKey,
      tag
    );
  }

  let albums: Album[];

  albums = includeMediaIds
    ? await Promise.all(
        result.albums.map(async (album) => ({
          ...album,
          mediaIds: (await DynamoDBService.getMediaIdsForAlbum(album.id)) || [],
        }))
      )
    : result.albums;

  albums = includeContentPreview
    ? await Promise.all(
        albums.map(async (album) => ({
          ...album,
          contentPreview:
            (await DynamoDBService.getContentPreviewForAlbum(album.id)) || null,
        }))
      )
    : albums;

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "albums",
    albums,
    result.lastEvaluatedKey,
    limit
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetAlbums);
