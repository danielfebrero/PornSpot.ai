import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { RevalidationService } from "@shared/utils/revalidation";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handleDeleteMedia = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;
  const mediaId = LambdaHandlerUtil.getPathParam(event, "mediaId");

  // Check if media exists
  const existingMedia = await DynamoDBService.getMedia(mediaId);
  if (!existingMedia) {
    return ResponseUtil.notFound(event, "Media not found");
  }

  // Check if user owns the media (or use helper for admin override)
  if (!LambdaHandlerUtil.checkOwnershipOrAdmin(existingMedia.createdBy, userId, auth.userRole)) {
    return ResponseUtil.forbidden(
      event,
      "You can only delete your own media"
    );
  }

  console.log("🗑️ Deleting media:", {
    mediaId,
    filename: existingMedia.filename,
    createdBy: existingMedia.createdBy,
  });

  // Get all album IDs that will be affected by this deletion (before deletion)
  const albumRelations = await DynamoDBService.getAlbumMediaRelations(
    mediaId
  );
  const affectedAlbumIds = albumRelations.map((relation) => relation.albumId);

  // Delete S3 object
  await S3Service.deleteObject(existingMedia.filename);
  console.log("✅ Deleted S3 object:", existingMedia.filename);

  // Clean up all comments for this media (this also deletes likes on those comments)
  await DynamoDBService.deleteAllCommentsForTarget(mediaId);
  console.log("✅ Cleaned up comments for media");

  // Clean up interactions (likes/bookmarks) for this media
  await DynamoDBService.deleteAllInteractionsForTarget(mediaId);
  console.log("✅ Cleaned up interactions for media");

  // Delete the media record from DynamoDB (this also removes from all albums)
  await DynamoDBService.deleteMedia(mediaId);
  console.log("✅ Deleted media record from DynamoDB");

  // Trigger revalidation for all affected albums
  if (affectedAlbumIds.length > 0) {
    for (const albumId of affectedAlbumIds) {
      await RevalidationService.revalidateAlbum(albumId);
    }
    console.log(
      "✅ Triggered revalidation for affected albums:",
      affectedAlbumIds
    );
  }

  return ResponseUtil.success(event, {
    message: "Media deleted successfully",
    deletedMediaId: mediaId,
    affectedAlbums: affectedAlbumIds,
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleDeleteMedia, {
  validatePathParams: ["mediaId"],
  includeRole: true,
});
