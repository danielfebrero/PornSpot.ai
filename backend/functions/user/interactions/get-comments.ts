/*
File objective: Retrieve comments for a target (album/media) or by user, with cursor pagination.
Auth: Public endpoint via LambdaHandlerUtil.withoutAuth (reads only).
Special notes:
- Supports two modes: target-based (/comments/{targetType}/{targetId}) and user-based (?user=username)
- Validates target existence; uses PaginationUtil with DEFAULT/MAX limits and LastEvaluatedKey cursors
- Enriches user-based results with lightweight target details when available
- Returns consistent paginated payload structure
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { Album, Comment, Media } from "@shared";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";

const handleGetComments = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔄 Get comments function called");

  // Get parameters from path and query string
  const targetType = event.pathParameters?.["targetType"];
  const targetId = event.pathParameters?.["targetId"];
  const queryParams = event.queryStringParameters || {};
  const userParam = queryParams["user"]; // New: support user parameter
  const includeContentPreview = queryParams["includeContentPreview"] === "true"; // New: support content preview

  // Check if this is a user-based query (when user param is provided)
  if (userParam) {
    return await getUserComments(event, userParam, includeContentPreview);
  }

  // Original target-based comments functionality - validate required parameters
  const validatedTargetType = ValidationUtil.validateRequiredString(
    targetType,
    "targetType"
  );
  const validatedTargetId = ValidationUtil.validateRequiredString(
    targetId,
    "targetId"
  );

  if (!["album", "media"].includes(validatedTargetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album' or 'media'"
    );
  }

  // Verify target exists
  if (validatedTargetType === "album") {
    const album = await DynamoDBService.getAlbum(validatedTargetId);
    if (!album) {
      return ResponseUtil.notFound(event, "Album not found");
    }
  } else {
    const media = await DynamoDBService.getMedia(validatedTargetId);
    if (!media) {
      return ResponseUtil.notFound(event, "Media not found");
    }
  }

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.comments,
      MAX_PAGINATION_LIMITS.comments
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  // Get comments for the target
  const result = await DynamoDBService.getCommentsForTarget(
    validatedTargetType as "album" | "media",
    validatedTargetId,
    limit,
    lastEvaluatedKey
  );

  // Convert CommentEntity to Comment format
  const comments: Comment[] = result.comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    targetType: comment.targetType,
    targetId: comment.targetId,
    userId: comment.userId,
    username: comment.username || "",
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    likeCount: comment.likeCount || 0,
    isEdited: comment.isEdited || false,
  }));

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "comments",
    comments,
    result.lastEvaluatedKey,
    limit
  );

  console.log(
    `✅ Retrieved ${comments.length} comments for ${validatedTargetType} ${validatedTargetId}`
  );

  return ResponseUtil.success(event, payload);
};

// Helper function to get comments by user
async function getUserComments(
  event: APIGatewayProxyEvent,
  targetUsername: string,
  includeContentPreview: boolean
): Promise<APIGatewayProxyResult> {
  const validatedUsername = ValidationUtil.validateRequiredString(
    targetUsername,
    "username"
  );

  // Look up the target user by username
  const targetUser = await DynamoDBService.getUserByUsername(validatedUsername);
  if (!targetUser) {
    return ResponseUtil.notFound(event, "User not found");
  }

  const targetUserId = targetUser.userId;

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.comments,
      MAX_PAGINATION_LIMITS.comments
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  // Get user's comments from DynamoDB
  const result = await DynamoDBService.getCommentsByUser(
    targetUserId,
    limit,
    lastEvaluatedKey
  );

  const { comments } = result;

  // Get target details for each comment to provide context
  const enrichedComments = await Promise.all(
    comments.map(async (comment) => {
      let targetDetails = null;

      if (comment.targetType === "album") {
        const album = await DynamoDBService.getAlbum(comment.targetId);
        if (album) {
          targetDetails = album;
          if (includeContentPreview) {
            targetDetails.contentPreview =
              await DynamoDBService.getContentPreviewForAlbum(comment.targetId);
          }
        }
      } else if (comment.targetType === "media") {
        // For media, get the media details directly
        const media = await DynamoDBService.getMedia(comment.targetId);
        if (media) {
          targetDetails = media;
        }
      }

      // Convert CommentEntity to Comment format with target details
      const enrichedComment: Comment & { target?: Media | Album } = {
        id: comment.id,
        content: comment.content,
        targetType: comment.targetType,
        targetId: comment.targetId,
        userId: comment.userId,
        username: comment.username || "",
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        likeCount: comment.likeCount || 0,
        isEdited: comment.isEdited || false,
        target: targetDetails ? targetDetails : undefined,
      };

      return enrichedComment;
    })
  );

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "comments",
    enrichedComments,
    result.lastEvaluatedKey,
    limit
  );

  console.log(
    `✅ Retrieved ${enrichedComments.length} comments for user ${validatedUsername}`
  );

  return ResponseUtil.success(event, payload);
}

export const handler = LambdaHandlerUtil.withoutAuth(handleGetComments);
