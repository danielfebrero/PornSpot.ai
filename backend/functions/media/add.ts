/**
 * @fileoverview Media Addition Handler
 * @description Adds existing media to an album or uploads new media by generating presigned S3 URL and creating record.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth (includes role).
 * @pathParams {string} albumId - Album to add media to.
 * @body AddMediaToAlbumRequest or UploadMediaRequest: { mediaId?: string, mediaIds?: string[], filename: string, mimeType: string, size?: number } for upload.
 * @notes
 * - Verifies album ownership or admin role.
 * - For association: validates media existence, adds to album, revalidates.
 * - For upload: generates presigned URL, creates pending media entity, links to album, increments metric, revalidates.
 * - Bulk association supported via mediaIds.
 * - Returns upload details or success message.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { UploadMediaRequest, AddMediaToAlbumRequest } from "@shared";
import { RevalidationService } from "@shared/utils/revalidation";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleAddMedia = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId, userRole = "user" } = auth;
  const albumId = LambdaHandlerUtil.getPathParam(event, "albumId");

  const request: AddMediaToAlbumRequest | UploadMediaRequest =
    LambdaHandlerUtil.parseJsonBody(event);

  // Verify album exists and check ownership
  const album = await DynamoDBService.getAlbum(albumId);
  if (!album) {
    return ResponseUtil.notFound(event, "Album not found");
  }

  if (!album.createdBy) {
    return ResponseUtil.badRequest(
      event,
      "Album ownership information is missing"
    );
  }

  // Check if user owns this album or has admin privileges using helper
  if (
    !LambdaHandlerUtil.checkOwnershipOrAdmin(album.createdBy, userId, userRole)
  ) {
    console.log("❌ User does not own album and is not admin:", {
      userId,
      albumCreatedBy: album.createdBy,
      userRole,
    });
    return ResponseUtil.forbidden(
      event,
      "Access denied: You can only add media to your own albums"
    );
  }

  console.log("✅ User authorized to add media to album");

  // Check if this is a media-to-album association request (single or bulk)
  if ("mediaId" in request || "mediaIds" in request) {
    // Association operation: Add existing media to album
    if (request.mediaId && request.mediaIds) {
      return ResponseUtil.badRequest(
        event,
        "Cannot specify both mediaId and mediaIds. Use one or the other."
      );
    }

    if (!request.mediaId && !request.mediaIds) {
      return ResponseUtil.badRequest(
        event,
        "Either mediaId or mediaIds must be specified for association"
      );
    }

    // Handle bulk addition
    if (request.mediaIds) {
      // Validate mediaIds array using shared validation
      const mediaIds = ValidationUtil.validateArray(
        request.mediaIds,
        "mediaIds",
        (id, index) =>
          ValidationUtil.validateRequiredString(id, `mediaId[${index}]`)
      ) as string[];

      try {
        const results = await DynamoDBService.bulkAddMediaToAlbum(
          albumId,
          mediaIds,
          userId
        );

        // Revalidate only if some media was successfully added
        if (results.successful.length > 0) {
          await RevalidationService.revalidateAlbum(albumId);
        }

        return ResponseUtil.success(event, {
          message:
            results.failed.length === 0
              ? `All ${results.successful.length} media items added to album successfully`
              : `${results.successful.length} media items added successfully, ${results.failed.length} failed`,
          results: {
            successfullyAdded: results.successful,
            failedAdditions: results.failed,
            totalProcessed: results.totalProcessed,
            successCount: results.successful.length,
            failureCount: results.failed.length,
          },
          albumId,
        });
      } catch (error: unknown) {
        console.error("Error in bulk add media to album:", error);
        const errorObj = error as Error & { message?: string };
        if (errorObj.message?.includes("not found")) {
          return ResponseUtil.notFound(event, errorObj.message);
        }
        throw error;
      }
    }

    // Handle single addition
    if (request.mediaId) {
      const mediaId = ValidationUtil.validateRequiredString(
        request.mediaId,
        "mediaId"
      );

      // Verify media exists
      const media = await DynamoDBService.getMedia(mediaId);
      if (!media) {
        return ResponseUtil.notFound(event, "Media not found");
      }

      // Add media to album
      try {
        await DynamoDBService.addMediaToAlbum(albumId, mediaId, userId);
      } catch (error: unknown) {
        const errorObj = error as Error & { message?: string };
        if (errorObj.message?.includes("already in album")) {
          return ResponseUtil.badRequest(event, errorObj.message);
        }
        throw error;
      }

      await RevalidationService.revalidateMedia(mediaId);
      await RevalidationService.revalidateAlbum(albumId);

      return ResponseUtil.success(event, {
        success: true,
        message: "Media added to album successfully",
        albumId,
        mediaId,
      });
    }

    return ResponseUtil.badRequest(event, "Invalid request parameters");
  } else {
    return ResponseUtil.badRequest(event, "mediaId or mediaIds is required");
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleAddMedia, {
  requireBody: true,
  validatePathParams: ["albumId"],
  includeRole: true,
});
