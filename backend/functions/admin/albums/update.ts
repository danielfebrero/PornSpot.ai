import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { UpdateAlbumRequest } from "@shared";
import { LambdaHandlerUtil, AdminAuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleUpdateAlbum = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  // Import heavy dependencies only when needed (after OPTIONS check)
  const { DynamoDBService } = await import("@shared/utils/dynamodb");
  const { CoverThumbnailUtil } = await import("@shared/utils/cover-thumbnail");

  const albumId = LambdaHandlerUtil.getPathParam(event, "albumId");
  const request: UpdateAlbumRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate request using shared validation
  if (request.title !== undefined) {
    ValidationUtil.validateRequiredString(request.title, "Album title");
  }

  // Check if album exists
  const existingAlbum = await DynamoDBService.getAlbumEntity(albumId);
  if (!existingAlbum) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  // Prepare updates
  const updates: Partial<typeof existingAlbum> = {
    updatedAt: new Date().toISOString(),
  };

  if (request.title !== undefined) {
    updates.title = request.title.trim();
  }

  if (request.tags !== undefined) {
    updates.tags = request.tags;
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

  // Update album
  await DynamoDBService.updateAlbum(albumId, updates);

  // Get updated album
  const updatedAlbum = await DynamoDBService.getAlbum(albumId);
  if (!updatedAlbum) {
    return ResponseUtil.internalError(
      event,
      "Failed to retrieve updated album"
    );
  }

  // Trigger revalidation
  await RevalidationService.revalidateAlbum(albumId);

  console.log(`📝 Admin ${auth.username} updated album ${albumId}`);

  return ResponseUtil.success(event, updatedAlbum);
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleUpdateAlbum, {
  requireBody: true,
  validatePathParams: ["albumId"],
});
