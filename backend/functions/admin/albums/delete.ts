/**
 * @fileoverview Admin Album Deletion Handler
 * @description Deletes an entire album, removing media associations (without deleting media files), cleaning up comments and interactions, and triggering revalidation.
 * @auth Requires admin authentication.
 * @pathParams {string} albumId - ID of the album to delete.
 * @notes
 * - Fetches and removes all media from the album but preserves media records.
 * - Deletes all comments for the album (cascades to comment likes).
 * - Cleans album-level interactions (likes, bookmarks).
 * - Uses DynamoDB delete operations for cleanup.
 * - Revalidates the albums listing page post-deletion.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import {
  LambdaHandlerUtil,
  AdminAuthResult,
} from "@shared/utils/lambda-handler";

const handleDeleteAlbum = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  const albumId = LambdaHandlerUtil.getPathParam(event, "albumId");

  // Check if album exists
  const existingAlbum = await DynamoDBService.getAlbum(albumId);
  if (!existingAlbum) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  // Get all media in the album to remove them from the album (not delete them)
  const { media } = await DynamoDBService.listAlbumMedia(albumId, 1000);

  // Remove all media from the album (don't delete the media itself)
  if (media.length > 0) {
    const removeMediaPromises = media.map((mediaItem) =>
      DynamoDBService.removeMediaFromAlbum(albumId, mediaItem.id)
    );
    await Promise.all(removeMediaPromises);
  }

  // Delete all comments for the album (this also deletes likes on those comments)
  await DynamoDBService.deleteAllCommentsForTarget(albumId);

  // Clean up interactions (likes/bookmarks) for the album itself
  await DynamoDBService.deleteAllInteractionsForTarget(albumId);

  // Delete the album
  await DynamoDBService.deleteAlbum(albumId);

  // Trigger revalidation
  await RevalidationService.revalidateAlbums();

  console.log(
    `🗑️ Admin ${auth.username} deleted album ${albumId} with ${media.length} media items`
  );

  return ResponseUtil.success(event, {
    message:
      "Album deleted successfully, media removed from album but preserved",
    deletedAlbumId: albumId,
    removedMediaCount: media.length,
  });
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleDeleteAlbum, {
  validatePathParams: ["albumId"],
});
