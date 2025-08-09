import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { BulkDeleteAlbumsRequest } from "@shared";
import { LambdaHandlerUtil, AdminAuthResult } from "@shared/utils/lambda-handler";

const handleBulkDeleteAlbums = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  const request: BulkDeleteAlbumsRequest = LambdaHandlerUtil.parseJsonBody(event);

  if (
    !request.albumIds ||
    !Array.isArray(request.albumIds) ||
    request.albumIds.length === 0
  ) {
    return ResponseUtil.badRequest(
      event,
      "Album IDs array is required and must not be empty"
    );
  }

  // Validate that all album IDs are strings
  if (
    !request.albumIds.every(
      (id) => typeof id === "string" && id.trim().length > 0
    )
  ) {
    return ResponseUtil.badRequest(
      event,
      "All album IDs must be non-empty strings"
    );
  }

  // Limit the number of albums that can be deleted in one request to avoid timeouts
  const MAX_BULK_DELETE_SIZE = 50;
  if (request.albumIds.length > MAX_BULK_DELETE_SIZE) {
    return ResponseUtil.badRequest(
      event,
      `Cannot delete more than ${MAX_BULK_DELETE_SIZE} albums at once. Please split into smaller batches.`
    );
  }

  const results = {
    successful: [] as string[],
    failed: [] as { albumId: string; error: string }[],
    totalMediaRemoved: 0,
  };

  console.log(`🗑️ Admin ${auth.username} starting bulk delete of ${request.albumIds.length} albums`);

  // Process each album deletion
  for (const albumId of request.albumIds) {
    try {
      console.log(`🔄 Processing album ${albumId}`);

      // Check if album exists
      const existingAlbum = await DynamoDBService.getAlbum(albumId);
      if (!existingAlbum) {
        console.log(`⚠️ Album ${albumId} not found, skipping`);
        results.failed.push({
          albumId,
          error: "Album not found",
        });
        continue;
      }

      // Get all media in the album to remove them from the album (not delete them)
      const { media } = await DynamoDBService.listAlbumMedia(albumId, 1000);
      console.log(`📱 Found ${media.length} media items in album ${albumId}`);

      // Remove all media from the album (don't delete the media itself)
      if (media.length > 0) {
        const removeMediaPromises = media.map((mediaItem) =>
          DynamoDBService.removeMediaFromAlbum(albumId, mediaItem.id)
        );
        await Promise.all(removeMediaPromises);
        results.totalMediaRemoved += media.length;
      }

      // Delete all comments for the album (this also deletes likes on those comments)
      await DynamoDBService.deleteAllCommentsForTarget(albumId);

      // Clean up interactions (likes/bookmarks) for the album itself
      await DynamoDBService.deleteAllInteractionsForTarget(albumId);

      // Delete the album
      await DynamoDBService.deleteAlbum(albumId);

      console.log(`✅ Successfully deleted album ${albumId}`);
      results.successful.push(albumId);
    } catch (error) {
      console.error(`❌ Error deleting album ${albumId}:`, error);
      results.failed.push({
        albumId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.log(
    `📊 Bulk delete complete. Success: ${results.successful.length}, Failed: ${results.failed.length}`
  );

  // Trigger revalidation if any albums were successfully deleted
  if (results.successful.length > 0) {
    await RevalidationService.revalidateAlbums();
  }

  // If all deletions failed, return an error
  if (results.successful.length === 0) {
    return ResponseUtil.internalError(event, "Failed to delete any albums");
  }

  // If some deletions failed but some succeeded, return success with details
  return ResponseUtil.success(event, {
    message:
      results.failed.length === 0
        ? "All albums deleted successfully"
        : `${results.successful.length} albums deleted successfully, ${results.failed.length} failed`,
    results: {
      successfullyDeleted: results.successful,
      failedDeletions: results.failed,
      totalMediaRemoved: results.totalMediaRemoved,
      totalProcessed: request.albumIds.length,
      successCount: results.successful.length,
      failureCount: results.failed.length,
    },
  });
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleBulkDeleteAlbums, {
  requireBody: true,
});
