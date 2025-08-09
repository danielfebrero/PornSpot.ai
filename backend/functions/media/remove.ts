import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleRemoveMedia = async (event: APIGatewayProxyEvent, auth: AuthResult): Promise<APIGatewayProxyResult> => {
  const albumId = ValidationUtil.validateRequiredString(event.pathParameters?.["albumId"], "Album ID");
  const mediaId = ValidationUtil.validateRequiredString(event.pathParameters?.["mediaId"], "Media ID");

  const userId = auth.userId;
  console.log("✅ Authenticated user:", userId);

  // Check if album exists
  const existingAlbum = await DynamoDBService.getAlbum(albumId);
  if (!existingAlbum) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  // Check if user owns the album
  if (existingAlbum.createdBy !== userId) {
    return ResponseUtil.forbidden(event, "You can only edit your own albums");
  }

  // Check if media exists
  const existingMedia = await DynamoDBService.getMedia(mediaId);
  if (!existingMedia) {
    return ResponseUtil.notFound(event, "Media not found");
  }

  // Remove media from album
  await DynamoDBService.removeMediaFromAlbum(albumId, mediaId);

  return ResponseUtil.success(event, {
    message: "Media removed from album successfully",
    albumId,
    mediaId,
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleRemoveMedia, {
  validatePathParams: ["albumId", "mediaId"],
});
