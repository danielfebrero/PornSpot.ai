/**
 * @fileoverview Admin Album Media Deletion Handler
 * @description Permanently deletes a specific media item from an album and the entire system, including S3 object deletion, interaction cleanup, and DynamoDB record removal.
 * @auth Requires admin authentication.
 * @pathParams {string} albumId - ID of the album containing the media.
 * @pathParams {string} mediaId - ID of the media to delete.
 * @notes
 * - Verifies album and media existence before deletion.
 * - Deletes S3 object using filename from media record.
 * - Cleans all interactions (likes, comments, etc.) for the media.
 * - Album media counts are auto-updated via deleteMedia method.
 * - Triggers revalidation for the affected album page.
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
  const albumId = LambdaHandlerUtil.getPathParam(event, "albumId");
  const mediaId = LambdaHandlerUtil.getPathParam(event, "mediaId");

  // Check if album exists
  const existingAlbum = await DynamoDBService.getAlbum(albumId);
  if (!existingAlbum) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  // Check if media exists
  const existingMedia = await DynamoDBService.getMedia(mediaId);
  if (!existingMedia) {
    return ResponseUtil.notFound(event, "Media not found");
  }

  // Delete the media
  // Delete S3 object
  await S3Service.deleteObject(existingMedia.filename);

  // Clean up interactions for this media
  await DynamoDBService.deleteAllInteractionsForTarget(mediaId);

  // Delete the media record from DynamoDB (this also removes from all albums)
  await DynamoDBService.deleteMedia(mediaId);

  // Note: Album media counts are automatically updated in deleteMedia method

  // Trigger revalidation
  await RevalidationService.revalidateAlbum(albumId);

  console.log(
    `🗑️ Admin ${auth.username} deleted media ${mediaId} from album ${albumId}`
  );

  return ResponseUtil.success(event, {
    message: "Media deleted successfully",
    deletedMediaId: mediaId,
    albumId: albumId,
  });
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleDeleteMedia, {
  validatePathParams: ["albumId", "mediaId"],
});
