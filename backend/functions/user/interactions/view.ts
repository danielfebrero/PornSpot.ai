/*
File objective: Record view events for albums, media, and user profiles.
Auth: Public endpoint (no session required) via LambdaHandlerUtil.withoutAuth.
Special notes:
- Validates targetType ('album' | 'media' | 'profile') and targetId, verifies target exists
- Increments per-target viewCount and creator profile metrics
  • album/media -> increments totalMediaViews for the creator
  • profile     -> increments totalProfileViews for the profile owner (by username)
- Uses single-table DynamoDB accessors and always returns success even if metric increments fail (best-effort)
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface ViewRequest {
  targetType: string;
  targetId: string;
}

const handleView = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔄 View tracking function called");

  const request: ViewRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate input using shared utility
  const targetType = ValidationUtil.validateRequiredString(
    request.targetType,
    "targetType"
  );
  const targetId = ValidationUtil.validateRequiredString(
    request.targetId,
    "targetId"
  );

  if (!["album", "media", "profile"].includes(targetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album', 'media', or 'profile'"
    );
  }

  // Verify target exists and increment appropriate counters
  if (targetType === "album") {
    const album = await DynamoDBService.getAlbum(targetId);
    if (!album) {
      return ResponseUtil.notFound(event, "Album not found");
    }

    // Increment view count for album
    await DynamoDBService.incrementAlbumViewCount(targetId, 1);

    // Increment creator's totalMediaViews metric
    if (album.createdBy) {
      try {
        await DynamoDBService.incrementUserProfileMetric(
          album.createdBy,
          "totalMediaViews"
        );
        console.log(
          `📈 Incremented totalMediaViews for album creator: ${album.createdBy}`
        );
      } catch (error) {
        console.warn(
          `⚠️ Failed to increment totalMediaViews for user ${album.createdBy}:`,
          error
        );
      }
    }
  } else if (targetType === "media") {
    // For media, verify it exists - no album context needed in new schema
    const media = await DynamoDBService.getMedia(targetId);
    if (!media) {
      return ResponseUtil.notFound(event, "Media not found");
    }

    // Increment view count for media
    await DynamoDBService.incrementMediaViewCount(targetId, 1);

    // Increment creator's totalMediaViews metric
    if (media.createdBy) {
      try {
        await DynamoDBService.incrementUserProfileMetric(
          media.createdBy,
          "totalMediaViews"
        );
        console.log(
          `📈 Incremented totalMediaViews for media creator: ${media.createdBy}`
        );
      } catch (error) {
        console.warn(
          `⚠️ Failed to increment totalMediaViews for user ${media.createdBy}:`,
          error
        );
      }
    }
  } else if (targetType === "profile") {
    // For profile views, targetId should be the username
    const username = targetId;

    // Get user by username to verify profile exists
    const profileUser = await DynamoDBService.getUserByUsername(username);
    if (!profileUser) {
      return ResponseUtil.notFound(event, "Profile not found");
    }

    // Increment profile view count for the profile owner
    try {
      await DynamoDBService.incrementUserProfileMetric(
        profileUser.userId,
        "totalProfileViews"
      );
      console.log(
        `📈 Incremented totalProfileViews for user: ${profileUser.userId} (${username})`
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to increment totalProfileViews for user ${profileUser.userId}:`,
        error
      );
      // Don't fail the entire request if profile view tracking fails
    }
  }

  return ResponseUtil.success(event, {
    targetType,
    targetId,
    action: "view_recorded",
  });
};

export const handler = LambdaHandlerUtil.withoutAuth(handleView, {
  requireBody: true,
});
