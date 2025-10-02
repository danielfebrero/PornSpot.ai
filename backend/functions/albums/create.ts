/**
 * @fileoverview Album Creation Handler
 * @description Creates a new album for authenticated users or admins, handling validation, permissions, thumbnail generation, and initial media addition.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth (includes role check).
 * @body CreateAlbumRequest: { title: string, tags?: string[], mediaIds?: string[], isPublic?: boolean, coverImageId?: string }
 * @notes
 * - Validates title, tags, mediaIds (ownership check for users), coverImageId.
 * - Enforces private content permissions based on user plan; admins bypass.
 * - Generates 5-tier thumbnails for cover image using CoverThumbnailUtil.
 * - Creates Album entity with GSIs for indexing (ALBUM, BY_CREATOR, PUBLIC, POPULARITY, CONTENT).
 * - Increments user's totalAlbums metric.
 * - Adds media to album if provided, skips duplicates.
 * - Creates Album-Tag relations if tags present.
 * - Triggers albums list revalidation.
 * - Returns created album with 201 status.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { CreateAlbumRequest, AlbumEntity } from "@shared";
import { PlanUtil } from "@shared/utils/plan";
import { getPlanPermissions } from "@shared/utils/permissions";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleCreateAlbum = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId, userRole = "user" } = auth;

  const request: CreateAlbumRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate album title using shared utility
  const title = ValidationUtil.validateAlbumTitle(request.title);

  // Validate selected media IDs if provided (for user albums)
  if (request.mediaIds && request.mediaIds.length > 0) {
    const mediaIds = ValidationUtil.validateArray(
      request.mediaIds,
      "mediaIds",
      (mediaId, index) =>
        ValidationUtil.validateRequiredString(mediaId, `mediaId[${index}]`)
    );

    // Verify all media items exist and belong to the user (unless admin)
    for (const mediaId of mediaIds) {
      const media = await DynamoDBService.getMedia(mediaId);
      if (!media) {
        return ResponseUtil.badRequest(
          event,
          `Media item ${mediaId} not found`
        );
      }
    }
  }

  // Validate optional tags
  const tags = request.tags
    ? ValidationUtil.validateTags(request.tags)
    : undefined;

  // Validate cover image ID if provided and generate thumbnails
  let coverImageId: string | undefined;

  if (
    request.coverImageId ||
    (request.mediaIds && request.mediaIds.length > 0)
  ) {
    if (request.coverImageId) {
      coverImageId = ValidationUtil.validateRequiredString(
        request.coverImageId,
        "coverImageId"
      );
    } else {
      coverImageId = ValidationUtil.validateRequiredString(
        request.mediaIds?.[0],
        "coverImageId"
      );
    }
  } else {
    coverImageId = request.mediaIds?.[0];
  }

  const coverMedia = await DynamoDBService.getMedia(coverImageId!);

  const albumId = uuidv4();
  const now = new Date().toISOString();

  // Determine isPublic value based on user role and permissions
  let isPublicValue: boolean;
  if (userRole === "admin") {
    // Admins can set any isPublic value they want
    isPublicValue = request.isPublic ?? false;
  } else {
    // For regular users, check if they have permission to create private content
    const userPlanInfo = await PlanUtil.getUserPlanInfo(userId);
    const planPermissions = getPlanPermissions(userPlanInfo.plan);

    if (planPermissions.canCreatePrivateContent) {
      // User has permission to create private content, so they can set isPublic
      isPublicValue = request.isPublic ?? true;
    } else {
      // User doesn't have permission to create private content, force to public
      isPublicValue = true;

      // Log a warning if user tried to set isPublic to false
      if (request.isPublic === false) {
        console.warn(
          `User ${userId} with plan ${userPlanInfo.plan} attempted to create private album but lacks permission`
        );
      }
    }
  }

  const albumEntity: AlbumEntity = {
    PK: `ALBUM#${albumId}`,
    SK: "METADATA",
    GSI1PK: "ALBUM",
    GSI1SK: `${now}#${albumId}`,
    GSI3PK: `ALBUM_BY_USER_${isPublicValue}`,
    GSI3SK: `${userId}#${now}#${albumId}`,
    GSI4PK: "ALBUM_BY_CREATOR",
    GSI4SK: `${userId}#${now}#${albumId}`,
    GSI5PK: "ALBUM",
    GSI5SK: isPublicValue.toString() + `#${now}`,
    GSI6PK: "POPULARITY",
    GSI6SK: 0,
    GSI7PK: "CONTENT",
    GSI7SK: `${now}`,
    EntityType: "Album",
    id: albumId,
    title,
    tags,
    createdAt: now,
    updatedAt: now,
    mediaCount: 0,
    isPublic: isPublicValue.toString(),
    likeCount: 0,
    bookmarkCount: 0,
    viewCount: 0,
    createdBy: userId,
    coverImageMediaId: coverImageId,
    createdByType: userRole === "admin" ? "admin" : "user",
    coverImageUrl: coverMedia?.thumbnailUrl,
    thumbnailUrls: coverMedia?.thumbnailUrls,
  };

  await DynamoDBService.createAlbum(albumEntity);

  // Create Album-Tag relationships if tags are provided
  if (tags && tags.length > 0) {
    try {
      await DynamoDBService.createAlbumTagRelations(
        albumId,
        tags,
        now,
        isPublicValue,
        userId
      );
      console.log(
        `🏷️ Created ${tags.length} tag relations for album: ${albumId}`
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to create tag relations for album ${albumId}:`,
        error
      );
      // Don't fail album creation if tag relations fail
    }
  }

  // Increment user's totalAlbums metric
  try {
    await DynamoDBService.incrementUserProfileMetric(userId, "totalAlbums");
    console.log(`📈 Incremented totalAlbums for user: ${userId}`);
  } catch (error) {
    console.warn(
      `⚠️ Failed to increment totalAlbums for user ${userId}:`,
      error
    );
  }

  // Add selected media to the album if provided
  if (request.mediaIds && request.mediaIds.length > 0) {
    for (const mediaId of request.mediaIds) {
      try {
        await DynamoDBService.addMediaToAlbum(albumId, mediaId, userId);
      } catch (error: unknown) {
        // Skip duplicates silently during album creation (shouldn't happen but defensive)
        const errorObj = error as Error & { message?: string };
        if (!errorObj.message?.includes("already in album")) {
          throw error;
        }
      }
    }
  }

  const album = DynamoDBService.convertAlbumEntityToAlbum(albumEntity);

  // Trigger revalidation
  await RevalidationService.revalidateAlbums();

  return ResponseUtil.created(event, album);
};

// Export the wrapped handler using the new utility
export const handler = LambdaHandlerUtil.withAuth(handleCreateAlbum, {
  requireBody: true,
  includeRole: true,
});
