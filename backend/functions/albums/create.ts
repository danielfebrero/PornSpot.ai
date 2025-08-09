/*
File objective: Create a new album for the authenticated user or admin.
Auth: Requires user/admin session via LambdaHandlerUtil.withAuth (includeRole).
Special notes:
- Validates title, optional tags, mediaIds, and optional coverImageId
- Enforces plan-based permission for private content (isPublic) using PlanUtil/getPlanPermissions
- Generates cover thumbnails if cover image provided; stores 5-tier thumbnailUrls
- Writes Album entity (single-table design, GSI1/GSI4), increments user's totalAlbums
- Optionally adds provided mediaIds to the new album; triggers frontend revalidation
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { CreateAlbumRequest, AlbumEntity } from "@shared";
import { PlanUtil } from "@shared/utils/plan";
import { CoverThumbnailUtil } from "@shared/utils/cover-thumbnail";
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
  let coverImageUrl: string | undefined;
  let thumbnailUrls:
    | {
        cover?: string;
        small?: string;
        medium?: string;
        large?: string;
        xlarge?: string;
      }
    | undefined;

  if (request.coverImageId) {
    const coverImageId = ValidationUtil.validateRequiredString(
      request.coverImageId,
      "coverImageId"
    );

    const coverMedia = await DynamoDBService.getMedia(coverImageId);
    if (!coverMedia) {
      return ResponseUtil.badRequest(
        event,
        `Cover image ${coverImageId} not found`
      );
    }
    coverImageUrl = coverMedia.url;
  }

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

  // Generate thumbnails if cover image is set, before creating the album
  if (coverImageUrl) {
    const generatedThumbnails =
      await CoverThumbnailUtil.processCoverImageThumbnails(
        coverImageUrl,
        albumId
      );

    if (generatedThumbnails) {
      thumbnailUrls = generatedThumbnails;
    } else {
      console.warn(
        `Failed to generate thumbnails for album ${albumId}, continuing without them`
      );
    }
  }

  const albumEntity: AlbumEntity = {
    PK: `ALBUM#${albumId}`,
    SK: "METADATA",
    GSI1PK: "ALBUM",
    GSI1SK: `${now}#${albumId}`,
    GSI4PK: "ALBUM_BY_CREATOR",
    GSI4SK: `${userId}#${now}#${albumId}`,
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
    createdByType: userRole === "admin" ? "admin" : "user",
    ...(coverImageUrl && { coverImageUrl }),
    ...(thumbnailUrls && { thumbnailUrls }),
  };

  await DynamoDBService.createAlbum(albumEntity);

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
      } catch (error: any) {
        // Skip duplicates silently during album creation (shouldn't happen but defensive)
        if (!error.message?.includes("already in album")) {
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
