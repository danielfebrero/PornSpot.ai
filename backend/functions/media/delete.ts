/**
 * @fileoverview Media Deletion Handler
 * @description Deletes single or bulk media items, including S3 objects, DynamoDB records, comments, interactions, and revalidates affected albums.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth (includes role).
 * @pathParams {string} [mediaId] - Optional for single deletion.
 * @body BulkDeleteRequest: { mediaIds?: string[] } for bulk.
 * @notes
 * - Supports single (path param) or bulk (body) deletion.
 * - Validates ownership for each media.
 * - Collects affected albums for revalidation.
 * - Deletes S3 objects in batch.
 * - Cleans comments, interactions, media record.
 * - Returns results with successful/failed, summary, affected albums.
 * - Uses 207 status for partial success.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { RevalidationService } from "@shared/utils/revalidation";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { AlbumEntity } from "@shared/shared-types";

interface BulkDeleteRequest {
  mediaIds: string[];
}

interface MediaDeletionResult {
  mediaId: string;
  success: boolean;
  error?: string;
  filename?: string;
}

interface BulkDeleteResponse {
  message: string;
  results: MediaDeletionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  affectedAlbums: string[];
}

const extractAlbumId = (album: AlbumEntity): string | null => {
  if (album.id) {
    return album.id;
  }

  if ((album as { albumId?: string }).albumId) {
    return (album as { albumId?: string }).albumId ?? null;
  }

  if (album.PK && album.PK.includes("#")) {
    return album.PK.split("#")[1] ?? null;
  }

  return null;
};

const handleDeleteMedia = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  try {
    // Determine if this is single or bulk deletion
    const mediaIdFromPath = LambdaHandlerUtil.getPathParam(event, "mediaId");

    let mediaIds: string[];
    let isBulkDelete = false;

    // Check for bulk deletion via request body
    if (event.body) {
      try {
        const requestBody: BulkDeleteRequest = JSON.parse(event.body);
        if (
          requestBody.mediaIds &&
          Array.isArray(requestBody.mediaIds) &&
          requestBody.mediaIds.length > 0
        ) {
          mediaIds = requestBody.mediaIds;
          isBulkDelete = true;
        } else if (mediaIdFromPath) {
          // Fallback to single deletion with path param
          mediaIds = [mediaIdFromPath];
        } else {
          return ResponseUtil.badRequest(
            event,
            "Either mediaId path parameter or mediaIds in request body is required"
          );
        }
      } catch (parseError) {
        if (mediaIdFromPath) {
          // Fallback to single deletion with path param
          mediaIds = [mediaIdFromPath];
        } else {
          return ResponseUtil.badRequest(event, "Invalid JSON in request body");
        }
      }
    } else if (mediaIdFromPath) {
      // Single deletion via path parameter
      mediaIds = [mediaIdFromPath];
    } else {
      return ResponseUtil.badRequest(
        event,
        "Either mediaId path parameter or mediaIds in request body is required"
      );
    }

    // Remove duplicates and validate format
    mediaIds = [...new Set(mediaIds)].filter(
      (id) => id && typeof id === "string" && id.trim().length > 0
    );

    if (mediaIds.length === 0) {
      return ResponseUtil.badRequest(event, "No valid media IDs provided");
    }

    console.log("🗑️ Processing deletion request:", {
      mediaIds,
      count: mediaIds.length,
      isBulkDelete,
      userId,
    });

    // Validate ownership and collect media information
    const mediaToDelete: Array<{
      mediaId: string;
      media: any;
      albumRelations: any[];
      coverAlbums: AlbumEntity[];
    }> = [];
    const results: MediaDeletionResult[] = [];
    const allAffectedAlbumIds = new Set<string>();

    for (const mediaId of mediaIds) {
      try {
        // Check if media exists
        const existingMedia = await DynamoDBService.getMedia(mediaId);
        if (!existingMedia) {
          results.push({
            mediaId,
            success: false,
            error: "Media not found",
          });
          continue;
        }

        if (!existingMedia.createdBy) {
          results.push({
            mediaId,
            success: false,
            error: "Media ownership information is missing",
          });
          continue;
        }

        // Check ownership
        if (
          !LambdaHandlerUtil.checkOwnershipOrAdmin(
            existingMedia.createdBy,
            userId,
            auth.userRole
          )
        ) {
          results.push({
            mediaId,
            success: false,
            error: "You can only delete your own media",
          });
          continue;
        }

        // Get album relations for this media
        const albumRelations = await DynamoDBService.getAlbumMediaRelations(
          mediaId
        );
        albumRelations.forEach((relation) =>
          allAffectedAlbumIds.add(relation.albumId)
        );

        const coverAlbums = await DynamoDBService.findAlbumsUsingCoverMedia(
          mediaId
        );

        mediaToDelete.push({
          mediaId,
          media: existingMedia,
          albumRelations,
          coverAlbums,
        });

        results.push({
          mediaId,
          success: true,
          filename: existingMedia.filename,
        });
      } catch (error) {
        console.error(`Error validating media ${mediaId}:`, error);
        results.push({
          mediaId,
          success: false,
          error: `Validation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    // If no media can be deleted, return early
    if (mediaToDelete.length === 0) {
      const response: BulkDeleteResponse = {
        message: "No media could be deleted",
        results,
        summary: {
          total: mediaIds.length,
          successful: 0,
          failed: mediaIds.length,
        },
        affectedAlbums: [],
      };
      return ResponseUtil.success(event, response, 400);
    }

    // Perform S3 deletions
    const filenames = mediaToDelete.map((item) => item.media.filename);
    console.log("🗑️ Deleting S3 objects:", filenames);

    const s3Results = await S3Service.deleteObjects(filenames);
    console.log("✅ S3 deletion results:", s3Results);

    // Update results with S3 deletion status
    for (const item of mediaToDelete) {
      const result = results.find((r) => r.mediaId === item.mediaId);
      if (result && result.success) {
        const wasS3Deleted = s3Results.successful.includes(item.media.filename);
        const s3Error = s3Results.failed.find(
          (f) => f.key === item.media.filename
        );

        if (!wasS3Deleted && s3Error) {
          result.success = false;
          result.error = `S3 deletion failed: ${s3Error.error}`;
        }
      }
    }

    // Perform DynamoDB cleanup for successfully deleted media
    const successfulDeletions = mediaToDelete.filter((item) => {
      const result = results.find((r) => r.mediaId === item.mediaId);
      return result && result.success;
    });

    console.log(
      `🗑️ Cleaning up DynamoDB for ${successfulDeletions.length} media items`
    );

    for (const item of successfulDeletions) {
      try {
        // Clean up comments for this media
        await DynamoDBService.deleteAllCommentsForTarget(item.mediaId);
        console.log(`✅ Cleaned up comments for media ${item.mediaId}`);

        // Clean up interactions for this media
        await DynamoDBService.deleteAllInteractionsForTarget(item.mediaId);
        console.log(`✅ Cleaned up interactions for media ${item.mediaId}`);

        // Delete the media record (this also removes from all albums)
        await DynamoDBService.deleteMedia(item.mediaId);
        console.log(`✅ Deleted media record ${item.mediaId} from DynamoDB`);

        if (item.coverAlbums.length > 0) {
          const refreshedAlbums = await Promise.all(
            item.coverAlbums.map(async (albumEntity) => {
              const albumId = extractAlbumId(albumEntity);
              if (!albumId) {
                return null;
              }

              try {
                await DynamoDBService.refreshAlbumCoverForAlbum(
                  albumId,
                  albumEntity
                );
                return albumId;
              } catch (error) {
                console.error(
                  `Error refreshing cover for album ${albumId}:`,
                  error
                );
                return null;
              }
            })
          );

          refreshedAlbums
            .filter((albumId): albumId is string => Boolean(albumId))
            .forEach((albumId) => allAffectedAlbumIds.add(albumId));
        }
      } catch (error) {
        console.error(
          `Error during DynamoDB cleanup for media ${item.mediaId}:`,
          error
        );
        const result = results.find((r) => r.mediaId === item.mediaId);
        if (result) {
          result.success = false;
          result.error = `DynamoDB cleanup failed: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }
    }

    // Trigger revalidation for affected albums
    const affectedAlbumIds = Array.from(allAffectedAlbumIds);
    if (affectedAlbumIds.length > 0) {
      console.log(
        "🔄 Triggering revalidation for affected albums:",
        affectedAlbumIds
      );
      for (const albumId of affectedAlbumIds) {
        try {
          await RevalidationService.revalidateAlbum(albumId);
        } catch (error) {
          console.error(`Failed to revalidate album ${albumId}:`, error);
          // Don't fail the entire operation for revalidation errors
        }
      }
      console.log("✅ Completed album revalidation");
    }

    // Calculate final summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const response: BulkDeleteResponse = {
      message: isBulkDelete
        ? `Bulk deletion completed: ${successful} successful, ${failed} failed`
        : successful > 0
        ? "Media deleted successfully"
        : "Media deletion failed",
      results,
      summary: {
        total: mediaIds.length,
        successful,
        failed,
      },
      affectedAlbums: affectedAlbumIds,
    };

    if (successful === 0) {
      return ResponseUtil.success(event, response, 400);
    } else if (failed > 0) {
      return ResponseUtil.success(event, response, 207); // 207 Multi-Status for partial success
    } else {
      return ResponseUtil.success(event, response);
    }
  } catch (error) {
    console.error("🚫 Unexpected error in media deletion:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : String(error)
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleDeleteMedia, {
  validatePathParams: [], // mediaId is optional since we support bulk deletion via body
  includeRole: true,
});
