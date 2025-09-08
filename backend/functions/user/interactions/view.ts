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
/**
 * @fileoverview View Tracking Handler
 * @description Records view events for albums, media, or profiles, updating view counts and metrics.
 * @auth Public via LambdaHandlerUtil.withoutAuth.
 * @body ViewRequest: { targetType: 'album'|'media'|'profile', targetId: string }
 * @notes
 * - Validates targetType and targetId; verifies target existence.
 * - Increments viewCount for target.
 * - Increments creator's totalMediaViews or totalProfileViews metric.
 * - Calls incrementViewCountForAnalytics.
 * - Always returns success even if metric increment fails (best-effort).
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import {
  LambdaHandlerUtil,
  OptionalAuthResult,
} from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { PSCIntegrationService } from "@shared/utils/psc-integration";

interface ViewRequest {
  targetType: string;
  targetId: string;
}

const handleView = async (
  event: APIGatewayProxyEvent,
  auth: OptionalAuthResult
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

  // Declare variables for PSC payout logic
  let album: any = null;
  let media: any = null;
  let profileUser: any = null;

  // Verify target exists and increment appropriate counters
  if (targetType === "album") {
    album = await DynamoDBService.getAlbum(targetId);
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
    media = await DynamoDBService.getMedia(targetId);
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
    // For profile, verify user exists
    profileUser = await DynamoDBService.getUserByUsername(targetId);
    if (!profileUser) {
      return ResponseUtil.notFound(event, "Profile not found");
    }

    // Increment view count for profile
    await DynamoDBService.incrementUserProfileMetric(
      profileUser.userId,
      "totalProfileViews"
    );
  }

  // PSC Payout Integration
  let pscPayoutResult = null;

  // Process PSC payout if user is authenticated and different from creator
  if (auth.userId) {
    let creatorId: string | null = null;

    // Determine creator ID for payout based on target type
    if (targetType === "album" && album?.createdBy) {
      creatorId = album.createdBy;
    } else if (targetType === "media" && media?.createdBy) {
      creatorId = media.createdBy;
    } else if (targetType === "profile" && profileUser?.userId) {
      creatorId = profileUser.userId;
    }

    // Only process payout if user is different from creator
    if (creatorId && auth.userId !== creatorId) {
      try {
        const payoutEvent = PSCIntegrationService.createPayoutEvent(
          targetType === "profile" ? "profile_view" : "view",
          targetType as "album" | "media" | "profile",
          targetId,
          auth.userId,
          creatorId,
          {
            albumId: targetType === "album" ? targetId : undefined,
            mediaId: targetType === "media" ? targetId : undefined,
            profileId:
              targetType === "profile" ? profileUser?.userId : undefined,
          }
        );

        pscPayoutResult = await PSCIntegrationService.processInteractionPayout(
          payoutEvent,
          true
        );

        if (pscPayoutResult.success && pscPayoutResult.shouldPayout) {
          console.log(
            `💰 PSC Payout: ${pscPayoutResult.amount} PSC to ${creatorId} for ${targetType} view`
          );
        } else if (pscPayoutResult.viewCount !== undefined) {
          console.log(
            `📊 View tracking: ${pscPayoutResult.viewCount}/10 for user ${auth.userId}`
          );
        }
      } catch (error) {
        console.warn("⚠️ PSC payout failed:", error);
        // Don't fail the entire request if PSC payout fails
      }
    }
  }

  DynamoDBService.incrementViewCountForAnalytics();

  return ResponseUtil.success(event, {
    targetType,
    targetId,
    action: "view_recorded",
    psc: pscPayoutResult
      ? {
          success: pscPayoutResult.success,
          amount: pscPayoutResult.amount,
          shouldPayout: pscPayoutResult.shouldPayout,
          viewCount: pscPayoutResult.viewCount,
          reason: pscPayoutResult.reason,
        }
      : null,
  });
};

export const handler = LambdaHandlerUtil.withOptionalAuth(handleView, {
  requireBody: true,
});
