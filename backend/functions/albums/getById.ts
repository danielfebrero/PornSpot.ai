/*
File objective: Get a single album by ID with a small recent comments list.
Auth: Public endpoint via LambdaHandlerUtil.withoutAuth.
Special notes:
- Retrieves up to 20 comments and attaches them to the album response; failure to fetch comments does not fail request
- Uses API-facing album shape helper (getAlbumForAPI)
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { Comment } from "@shared";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleGetAlbumById = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const albumId = ValidationUtil.validateRequiredString(
    event.pathParameters?.["albumId"],
    "albumId"
  );

  const album = await DynamoDBService.getAlbumForAPI(albumId);

  if (!album) {
    return ResponseUtil.notFound(event, "Album not found");
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

export const handler = LambdaHandlerUtil.withoutAuth(handleGetAlbumById, {
  validatePathParams: ["albumId"],
});
