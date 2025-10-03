import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { Comment, EnhancedMedia } from "@shared";
import {
  LambdaHandlerUtil,
  OptionalAuthResult,
} from "@shared/utils/lambda-handler";
import { enhanceMedia } from "@shared/utils/media";

const handleGetMediaById = async (
  event: APIGatewayProxyEvent,
  auth: OptionalAuthResult
): Promise<APIGatewayProxyResult> => {
  const mediaId = LambdaHandlerUtil.getPathParam(event, "mediaId");

  // Find media by ID using GSI2
  const mediaEntity = await DynamoDBService.findMediaById(mediaId);
  console.log("Media entity found:", mediaEntity);

  if (!mediaEntity) {
    return ResponseUtil.notFound(event, "Media not found");
  }

  const isPublic =
    mediaEntity.isPublic === undefined || mediaEntity.isPublic === "true";
  const isOwner =
    !!auth.userId &&
    mediaEntity.createdBy &&
    mediaEntity.createdBy === auth.userId;
  const isPrivileged =
    auth.userRole === "admin" || auth.userRole === "moderator";

  console.log({
    isPublic,
    isOwner,
    isPrivileged,
    userId: auth.userId,
    userRole: auth.userRole,
    createdBy: mediaEntity.createdBy,
  });

  if (!isPublic && !isOwner && !isPrivileged) {
    return ResponseUtil.forbidden(event, "Content is private");
  }

  // Convert to response format
  // Convert MediaEntity to Media using shared helper
  const mediaResponse: EnhancedMedia =
    DynamoDBService.convertMediaEntityToMedia(mediaEntity);
  console.log("Media response created:", mediaResponse);

  const enhancedMediaResponse = await enhanceMedia(mediaResponse, mediaEntity);

  // Fetch albums containing this media
  try {
    const albums = await DynamoDBService.getAlbumsForMedia(mediaId);
    if (albums.length > 0) {
      enhancedMediaResponse.albums = albums.filter((album) => album.isPublic);
      enhancedMediaResponse.albums = await Promise.all(
        enhancedMediaResponse.albums.map(async (album) => ({
          ...album,
          contentPreview:
            (await DynamoDBService.getContentPreviewForAlbum(album.id)) || null,
        }))
      );
    }
  } catch (error) {
    console.error("Failed to fetch albums for media:", error);
    // Don't fail the request if albums can't be fetched
  }

  // Fetch comments for this media
  try {
    const commentsResult = await DynamoDBService.getCommentsForTarget(
      mediaEntity.type,
      mediaId,
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

    // Add comments to media response
    (enhancedMediaResponse as any).comments = comments;
  } catch (error) {
    console.error("Failed to fetch comments for media:", error);
    // Don't fail the request if comments can't be fetched
    (enhancedMediaResponse as any).comments = [];
  }

  console.log("Returning media response:", enhancedMediaResponse);
  return ResponseUtil.success(event, enhancedMediaResponse);
};

export const handler = LambdaHandlerUtil.withOptionalAuth(handleGetMediaById, {
  validatePathParams: ["mediaId"],
  includeRole: true,
});
