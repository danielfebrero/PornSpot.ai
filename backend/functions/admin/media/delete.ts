/**
 * @fileoverview Admin Media Deletion Handler
 * @description Permanently deletes a media item system-wide, including S3 object, DynamoDB record, associated comments and interactions, and revalidates affected albums.
 * @auth Requires admin authentication.
 * @pathParams {string} mediaId - ID of the media to delete.
 * @notes
 * - Verifies media existence before deletion.
 * - Fetches affected album IDs to trigger targeted revalidation.
 * - Deletes S3 object using filename.
 * - Cascades deletion to comments (including their likes) and media interactions.
 * - Album associations are automatically cleaned via deleteMedia.
 * - Logs detailed deletion steps for auditing.
 * - Returns affected album IDs in response.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { RevalidationService } from "@shared/utils/revalidation";
import {
  LambdaHandlerUtil,
  AdminAuthResult,
} from "@shared/utils/lambda-handler";

const handleDeleteMedia = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  const mediaId = LambdaHandlerUtil.getPathParam(event, "mediaId");

  // Check if media exists
  const existingMedia = await DynamoDBService.getMedia(mediaId);
  if (!existingMedia) {
    return ResponseUtil.notFound(event, "Media not found");
  }

  console.log("🗑️ Admin deleting media:", {
    mediaId,
    filename: existingMedia.filename,
    createdBy: existingMedia.createdBy,
    adminUser: auth.username,
  });

  // Get all album IDs that will be affected by this deletion (before deletion)
  const albumRelations = await DynamoDBService.getAlbumMediaRelations(mediaId);
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

  console.log(
    `🗑️ Admin ${auth.username} successfully deleted media ${mediaId} from ${affectedAlbumIds.length} albums`
  );

  return ResponseUtil.success(event, {
    message: "Media deleted successfully",
    deletedMediaId: mediaId,
    affectedAlbums: affectedAlbumIds,
  });
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleDeleteMedia, {
  validatePathParams: ["mediaId"],
});
