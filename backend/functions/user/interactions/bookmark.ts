import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { InteractionRequest } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { CounterUtil } from "@shared/utils/counter";
import { PSCIntegrationService } from "@shared/utils/psc-integration";

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
  if (!["album", "image", "video"].includes(targetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album' or 'media'"
    );
  }

  // Validate action
  if (!["add", "remove"].includes(action)) {
    return ResponseUtil.badRequest(event, "action must be 'add' or 'remove'");
  }

  // Declare PSC payout result at function level
  let pscPayoutResult: {
    success: boolean;
    amount?: number;
    shouldPayout?: boolean;
    reason?: string;
    viewCount?: number;
  } | null = null;

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
    await DynamoDBService.createUserInteraction(
      userId,
      "bookmark",
      targetType as "image" | "video" | "album",
      targetId
    );

    // Get target details and increment bookmark count for the target using shared utility
    let album, media;
    let targetCreatorId: string | undefined;

    if (targetType === "album") {
      await CounterUtil.incrementAlbumBookmarkCount(targetId, 1);

      // Get album creator and increment their totalBookmarksReceived metric
      album = await DynamoDBService.getAlbum(targetId);
      if (album?.createdBy) {
        targetCreatorId = album.createdBy;
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
      media = await DynamoDBService.getMedia(targetId);
      if (media?.createdBy) {
        targetCreatorId = media.createdBy;
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

    // Create notification for the target user
    if (targetCreatorId) {
      try {
        await DynamoDBService.createNotification(
          targetCreatorId,
          userId,
          "bookmark",
          targetType as "album" | "image" | "video",
          targetId
        );
        console.log(
          `📬 Created bookmark notification for user ${targetCreatorId}`
        );
      } catch (error) {
        console.warn(`⚠️ Failed to create bookmark notification:`, error);
      }

      // PSC Payout Integration for bookmarks (immediate payout)
      if (userId !== targetCreatorId) {
        try {
          const payoutEvent = PSCIntegrationService.createPayoutEvent(
            "bookmark",
            targetType as "album" | "image" | "video",
            targetId,
            userId,
            targetCreatorId,
            {
              albumId: targetType === "album" ? targetId : undefined,
              mediaId:
                targetType === "image" || targetType === "video"
                  ? targetId
                  : undefined,
            }
          );

          pscPayoutResult =
            await PSCIntegrationService.processInteractionPayout(
              payoutEvent,
              true // Bookmarks require auth
            );

          if (pscPayoutResult.success && pscPayoutResult.shouldPayout) {
            console.log(
              `💰 PSC Payout: ${pscPayoutResult.amount} PSC to ${targetCreatorId} for ${targetType} bookmark`
            );
          }
        } catch (error) {
          console.warn("⚠️ PSC payout failed:", error);
          // Don't fail the entire request if PSC payout fails
        }
      }
    }

    return ResponseUtil.created(event, {
      userId: userId,
      interactionType: "bookmark",
      targetType,
      targetId,
      createdAt: now,
      psc: pscPayoutResult
        ? {
            success: pscPayoutResult.success,
            amount: pscPayoutResult.amount,
            shouldPayout: pscPayoutResult.shouldPayout,
            reason: pscPayoutResult.reason,
          }
        : null,
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
