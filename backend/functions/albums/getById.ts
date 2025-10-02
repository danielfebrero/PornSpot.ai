/**
 * @fileoverview Single Album Retrieval Handler
 * @description Fetches a specific album by ID, including up to 20 recent comments.
 * @auth Public endpoint via LambdaHandlerUtil.withoutAuth.
 * @pathParams {string} albumId - ID of the album to retrieve.
 * @notes
 * - Validates albumId presence.
 * - Uses getAlbumForAPI for API-safe response shape.
 * - Fetches recent comments (limit 20) for the album; attaches to response.
 * - Gracefully handles comment fetch failures (returns empty array).
 * - No auth required; album must be public or accessible.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { Comment } from "@shared";
import {
  LambdaHandlerUtil,
  OptionalAuthResult,
} from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleGetAlbumById = async (
  event: APIGatewayProxyEvent,
  auth: OptionalAuthResult
): Promise<APIGatewayProxyResult> => {
  const albumId = ValidationUtil.validateRequiredString(
    event.pathParameters?.["albumId"],
    "albumId"
  );

  const album = await DynamoDBService.getAlbumForAPI(albumId);

  if (!album) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  const isOwner = !!auth.userId && album.createdBy === auth.userId;
  const isPrivileged =
    auth.userRole === "admin" || auth.userRole === "moderator";

  if (!album.isPublic && !isOwner && !isPrivileged) {
    return ResponseUtil.forbidden(event, "Content is private");
  }

  // Fetch comments for this album
  try {
    const commentsResult = await DynamoDBService.getCommentsForTarget(
      "album",
      albumId,
      20
    );
    const comments: Comment[] = commentsResult.comments.map((comment) => ({
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

    // Add comments to album response
    (album as any).comments = comments;
  } catch (error) {
    console.error("Failed to fetch comments for album:", error);
    // Don't fail the request if comments can't be fetched
    (album as any).comments = [];
  }

  return ResponseUtil.success(event, album);
};

export const handler = LambdaHandlerUtil.withOptionalAuth(handleGetAlbumById, {
  validatePathParams: ["albumId"],
  includeRole: true,
});
