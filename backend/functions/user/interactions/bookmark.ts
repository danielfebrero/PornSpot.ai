import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { InteractionRequest, UserInteractionEntity, TargetType } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { CounterUtil } from "@shared/utils/counter";

const handleBookmarkInteraction = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  console.log("🔄 Bookmark/Unbookmark function called");

  const body: InteractionRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate input using shared validation
  const targetType = ValidationUtil.validateRequiredString(
    body.targetType,
    "targetType"
  );
  const targetId = ValidationUtil.validateRequiredString(
    body.targetId,
    "targetId"
  );
  const action = ValidationUtil.validateRequiredString(body.action, "action");

  // Validate target type
  if (!["album", "media"].includes(targetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album' or 'media'"
    );
  }

  // Validate action
  if (!["add", "remove"].includes(action)) {
    return ResponseUtil.badRequest(event, "action must be 'add' or 'remove'");
  }

  // Verify target exists
  if (targetType === "album") {
    const album = await DynamoDBService.getAlbum(targetId);
    if (!album) {
      return ResponseUtil.notFound(event, "Album not found");
    }
  } else {
    // For media, verify it exists - no albumId needed in new schema
    const media = await DynamoDBService.getMedia(targetId);
    if (!media) {
      return ResponseUtil.notFound(event, "Media not found");
    }
  }

  const now = new Date().toISOString();

  if (action === "add") {
    // Check if already bookmarked
    const existingBookmark = await DynamoDBService.getUserInteraction(
      userId,
      "bookmark",
      targetId
    );

    if (existingBookmark) {
      return ResponseUtil.error(event, "Already bookmarked", 409);
    }

    // Create bookmark interaction
    const interaction: UserInteractionEntity = {
      PK: `USER#${userId}`,
      SK: `INTERACTION#bookmark#${targetId}`,
      GSI1PK: `INTERACTION#bookmark#${targetId}`,
      GSI1SK: userId,
      EntityType: "UserInteraction",
      userId: userId,
      interactionType: "bookmark",
      targetType: targetType as TargetType,
      targetId,
      createdAt: now,
    };

    await DynamoDBService.createUserInteraction(interaction);

    // Increment bookmark count for the target using shared utility
    if (targetType === "album") {
      await CounterUtil.incrementAlbumBookmarkCount(targetId, 1);

      // Get album creator and increment their totalBookmarksReceived metric
      const album = await DynamoDBService.getAlbum(targetId);
      if (album?.createdBy) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            album.createdBy,
            "totalBookmarksReceived"
          );
          console.log(
            `📈 Incremented totalBookmarksReceived for album creator: ${album.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to increment totalBookmarksReceived for user ${album.createdBy}:`,
            error
          );
        }
      }
    } else {
      await CounterUtil.incrementMediaBookmarkCount(targetId, 1);

      // Get media creator and increment their totalBookmarksReceived metric
      const media = await DynamoDBService.getMedia(targetId);
      if (media?.createdBy) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            media.createdBy,
            "totalBookmarksReceived"
          );
          console.log(
            `📈 Incremented totalBookmarksReceived for media creator: ${media.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to increment totalBookmarksReceived for user ${media.createdBy}:`,
            error
          );
        }
      }
    }

    return ResponseUtil.created(event, {
      userId: userId,
      interactionType: "bookmark",
      targetType,
      targetId,
      createdAt: now,
    });
  } else {
    // Remove bookmark
    await DynamoDBService.deleteUserInteraction(userId, "bookmark", targetId);

    // Decrement bookmark count for the target using shared utility
    if (targetType === "album") {
      await CounterUtil.incrementAlbumBookmarkCount(targetId, -1);

      // Get album creator and decrement their totalBookmarksReceived metric
      const album = await DynamoDBService.getAlbum(targetId);
      if (album?.createdBy) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            album.createdBy,
            "totalBookmarksReceived",
            -1
          );
          console.log(
            `📉 Decremented totalBookmarksReceived for album creator: ${album.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to decrement totalBookmarksReceived for user ${album.createdBy}:`,
            error
          );
        }
      }
    } else {
      await CounterUtil.incrementMediaBookmarkCount(targetId, -1);

      // Get media creator and decrement their totalBookmarksReceived metric
      const media = await DynamoDBService.getMedia(targetId);
      if (media?.createdBy) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            media.createdBy,
            "totalBookmarksReceived",
            -1
          );
          console.log(
            `📉 Decremented totalBookmarksReceived for media creator: ${media.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to decrement totalBookmarksReceived for user ${media.createdBy}:`,
            error
          );
        }
      }
    }

    return ResponseUtil.success(event, {
      userId: userId,
      interactionType: "bookmark",
      targetType,
      targetId,
      action: "removed",
    });
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleBookmarkInteraction, {
  requireBody: true,
});
