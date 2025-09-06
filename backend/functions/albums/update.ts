/**
 * @fileoverview Album Update Handler
 * @description Updates album metadata, including title, tags, visibility, and cover image with thumbnail regeneration.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth (includes role check).
 * @pathParams {string} albumId - ID of the album to update.
 * @body UpdateAlbumRequest: { title?: string, tags?: string[], isPublic?: boolean, coverImageUrl?: string }
 * @notes
 * - Lazy-loads heavy dependencies after OPTIONS.
 * - Verifies ownership or admin role.
 * - Validates optional fields (title, tags).
 * - Regenerates thumbnails for new cover; clears for removal.
 * - Updates Album-Tag relations if tags changed.
 * - Updates updatedAt timestamp.
 * - Triggers albums list revalidation.
 * - Returns full updated album.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { UpdateAlbumRequest } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleUpdateAlbum = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  // Import heavy dependencies only when needed (after OPTIONS check)
  const { DynamoDBService } = await import("@shared/utils/dynamodb");
  const { CoverThumbnailUtil } = await import("@shared/utils/cover-thumbnail");

  const { userId, userRole = "user" } = auth;

  const albumId = LambdaHandlerUtil.getPathParam(event, "albumId");
  const request: UpdateAlbumRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate request using shared utilities
  const title =
    request.title !== undefined
      ? ValidationUtil.validateAlbumTitle(request.title)
      : undefined;

  const tags = request.tags
    ? ValidationUtil.validateTags(request.tags)
    : undefined;

  // Check if album exists
  const existingAlbum = await DynamoDBService.getAlbumEntity(albumId);
  if (!existingAlbum) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  if (!existingAlbum.createdBy) {
    return ResponseUtil.badRequest(
      event,
      "Album ownership information is missing"
    );
  }

  // Check if user owns the album (or is admin)
  if (
    !LambdaHandlerUtil.checkOwnershipOrAdmin(
      existingAlbum.createdBy,
      userId,
      userRole
    )
  ) {
    return ResponseUtil.forbidden(event, "You can only edit your own albums");
  }

  // Prepare updates
  const updates: Partial<typeof existingAlbum> = {
    updatedAt: new Date().toISOString(),
  };

  if (title !== undefined) {
    updates.title = title.trim();
  }

  if (tags !== undefined) {
    updates.tags = tags;
  }

  if (request.isPublic !== undefined) {
    updates.isPublic = request.isPublic.toString();
  }

  if (request.coverImageUrl !== undefined) {
    updates.coverImageUrl = request.coverImageUrl;

    // Generate thumbnails when cover image is updated
    if (request.coverImageUrl) {
      const thumbnailUrls =
        await CoverThumbnailUtil.processCoverImageThumbnails(
          request.coverImageUrl,
          albumId
        );

      if (thumbnailUrls) {
        // Add thumbnailUrls to the updates
        updates.thumbnailUrls = thumbnailUrls;
      } else {
        console.warn(
          `Failed to generate thumbnails for album ${albumId}, continuing without them`
        );
      }
    } else {
      // If coverImageUrl is being cleared, also clear thumbnailUrls
      updates.thumbnailUrls = undefined;
    }
  }

  // Apply updates
  await DynamoDBService.updateAlbum(albumId, updates);

  // Update Album-Tag relationships if tags were modified
  if (tags !== undefined) {
    try {
      // Determine the current isPublic value (use updated value if changed, otherwise existing)
      const currentIsPublic =
        request.isPublic !== undefined
          ? request.isPublic
          : existingAlbum.isPublic === "true";
      await DynamoDBService.updateAlbumTagRelations(
        albumId,
        tags,
        existingAlbum.createdAt,
        currentIsPublic,
        userId
      );
      console.log(`🏷️ Updated tag relations for album: ${albumId}`);
    } catch (error) {
      console.warn(
        `⚠️ Failed to update tag relations for album ${albumId}:`,
        error
      );
      // Don't fail album update if tag relations fail
    }
  }

  // Fetch and return updated album
  const updatedAlbum = await DynamoDBService.getAlbum(albumId);

  // Trigger revalidation
  await RevalidationService.revalidateAlbums();

  return ResponseUtil.success(event, updatedAlbum);
};

// Export the wrapped handler using the new utility
export const handler = LambdaHandlerUtil.withAuth(handleUpdateAlbum, {
  requireBody: true,
  includeRole: true,
  validatePathParams: ["albumId"],
});
