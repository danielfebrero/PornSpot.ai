/*
File objective: Delete an album owned by the authenticated user (or admin).
Auth: Requires user/admin via LambdaHandlerUtil.withAuth (includeRole).
Special notes:
- Verifies ownership; removes media links from album without deleting media files
- Deletes all album comments and related interactions
- Decrements creator's totalAlbums and triggers revalidation
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handleDeleteAlbum = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId, userRole = "user" } = auth;
  const albumId = LambdaHandlerUtil.getPathParam(event, "albumId");

  console.log("✅ Authenticated user:", userId);
  console.log("🎭 User role:", userRole);

  // Check if album exists
  const existingAlbum = await DynamoDBService.getAlbum(albumId);
  if (!existingAlbum) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  if (!existingAlbum.createdBy) {
    return ResponseUtil.badRequest(
      event,
      "Album ownership information is missing"
    );
  }

  // Check if user owns the album (or is admin) using helper
  if (
    !LambdaHandlerUtil.checkOwnershipOrAdmin(
      existingAlbum.createdBy,
      userId,
      userRole
    )
  ) {
    return ResponseUtil.forbidden(event, "You can only delete your own albums");
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

  // Delete Album-Tag relationships
  try {
    await DynamoDBService.deleteAlbumTagRelations(albumId);
    console.log(`🏷️ Deleted tag relations for album: ${albumId}`);
  } catch (error) {
    console.warn(
      `⚠️ Failed to delete tag relations for album ${albumId}:`,
      error
    );
    // Don't fail album deletion if tag relations cleanup fails
  }

  // Delete the album
  await DynamoDBService.deleteAlbum(albumId);

  // Decrement user's totalAlbums metric
  if (existingAlbum.createdBy) {
    try {
      await DynamoDBService.incrementUserProfileMetric(
        existingAlbum.createdBy,
        "totalAlbums",
        -1
      );
      console.log(
        `📉 Decremented totalAlbums for user: ${existingAlbum.createdBy}`
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to decrement totalAlbums for user ${existingAlbum.createdBy}:`,
        error
      );
    }
  }

  // Trigger revalidation
  await RevalidationService.revalidateAlbums();

  return ResponseUtil.success(event, {
    message:
      "Album deleted successfully, media removed from album but preserved",
    deletedAlbumId: albumId,
    removedMediaCount: media.length,
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleDeleteAlbum, {
  validatePathParams: ["albumId"],
  includeRole: true,
});
