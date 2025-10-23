/*
File objective: Add or remove a like interaction on album, media, or comment.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Validates action ('add'|'remove') and target type; verifies target existence
- Uses single-table interaction entities; distinct SK pattern for comment likes
- Updates per-target like counters and increments/decrements creator's totalLikesReceived
- Idempotency: returns 409 on duplicate like attempts
*/
/**
 * @fileoverview Like Interaction Handler
 * @description Adds or removes a like on album, media, or comment, updating counters and notifications.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth.
 * @body InteractionRequest: { targetType: 'album'|'media'|'comment', targetId: string, action: 'add'|'remove' }
 * @notes
 * - Validates action and target type; verifies target existence.
 * - Checks existing like to prevent duplicates.
 * - Updates interaction entity, increments/decrements counters.
 * - Increments/decrements creator's totalLikesReceived metric.
 * - Creates notification for target creator.
 * - Idempotent: 409 on duplicate add.
 * - Returns action result.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { InteractionRequest, NotificationTargetType } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { CounterUtil } from "@shared/utils/counter";
import { PSCIntegrationService } from "@shared/utils/psc-integration";
import { EmailService } from "@shared/utils/email";
import {
  getAlbumThumbnailUrl,
  getCommentSnippet,
  getMediaThumbnailUrl,
  getMediaTitle,
  getUserDisplayName,
  type MaybeAlbum,
  type MaybeComment,
  type MaybeMedia,
  type MaybeUser,
} from "@shared/utils/notification-email-helpers";

const handleLikeInteraction = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  console.log("🔄 Like/Unlike function called");

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
  if (!["album", "image", "video", "comment"].includes(targetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album', 'media', or 'comment'"
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
  } else if (targetType === "image" || targetType === "video") {
    // For media, verify it exists - no albumId needed in new schema
    const media = await DynamoDBService.getMedia(targetId);
    if (!media) {
      return ResponseUtil.notFound(event, "Media not found");
    }
  } else if (targetType === "comment") {
    // For comments, verify it exists
    const comment = await DynamoDBService.getComment(targetId);
    if (!comment) {
      return ResponseUtil.notFound(event, "Comment not found");
    }
  }

  if (action === "add") {
    // Check if already liked - use different method for comments
    let existingLike;
    if (targetType === "comment") {
      existingLike = await DynamoDBService.getUserInteractionForComment(
        userId,
        "like",
        targetId
      );
    } else {
      existingLike = await DynamoDBService.getUserInteraction(
        userId,
        "like",
        targetId
      );
    }

    if (existingLike) {
      return ResponseUtil.error(event, "Already liked", 409);
    }

    // Create like interaction
    await DynamoDBService.createUserInteraction(
      userId,
      "like",
      targetType as "image" | "video" | "album" | "comment",
      targetId
    );

    // Get target details and increment like count for the target using shared utility
    let album, media, comment;
    let targetCreatorId: string | undefined;

    if (targetType === "album") {
      await CounterUtil.incrementAlbumLikeCount(targetId, 1);

      // Get album creator and increment their totalLikesReceived metric
      album = await DynamoDBService.getAlbum(targetId);
      if (album?.createdBy) {
        targetCreatorId = album.createdBy;
        try {
          await DynamoDBService.incrementUserProfileMetric(
            album.createdBy,
            "totalLikesReceived"
          );
          console.log(
            `📈 Incremented totalLikesReceived for album creator: ${album.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to increment totalLikesReceived for user ${album.createdBy}:`,
            error
          );
        }
      }
    } else if (targetType === "image" || targetType === "video") {
      await CounterUtil.incrementMediaLikeCount(targetId, 1);

      // Get media creator and increment their totalLikesReceived metric
      media = await DynamoDBService.getMedia(targetId);
      if (media?.createdBy) {
        targetCreatorId = media.createdBy;
        try {
          await DynamoDBService.incrementUserProfileMetric(
            media.createdBy,
            "totalLikesReceived"
          );
          console.log(
            `📈 Incremented totalLikesReceived for media creator: ${media.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to increment totalLikesReceived for user ${media.createdBy}:`,
            error
          );
        }
      }
    } else if (targetType === "comment") {
      await CounterUtil.incrementCommentLikeCount(targetId, 1);

      // Get comment creator and increment their totalLikesReceived metric
      comment = await DynamoDBService.getComment(targetId);
      if (comment?.userId) {
        targetCreatorId = comment.userId;
        try {
          await DynamoDBService.incrementUserProfileMetric(
            comment.userId,
            "totalLikesReceived"
          );
          console.log(
            `📈 Incremented totalLikesReceived for comment creator: ${comment.userId}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to increment totalLikesReceived for user ${comment.userId}:`,
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
          "like",
          targetType as NotificationTargetType,
          targetId
        );
        console.log(`📬 Created like notification for user ${targetCreatorId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create like notification:`, error);
      }

      if (targetCreatorId !== userId) {
        try {
          const targetUser = await DynamoDBService.getUserById(targetCreatorId);
          if (
            targetUser?.email &&
            targetUser.emailPreferences?.unreadNotifications === "always"
          ) {
            const sourceUser = await DynamoDBService.getUserById(userId);
            const actorName = getUserDisplayName(sourceUser as MaybeUser);
            const locale = (targetUser.preferredLanguage || "en").toLowerCase();

            let emailTargetType: "album" | "image" | "video" | "comment" =
              targetType === "album"
                ? "album"
                : targetType === "image" || targetType === "video"
                ? (targetType as "image" | "video")
                : "comment";
            let emailTargetId = targetId;
            let emailTargetTitle: string | undefined;
            let emailThumbnailUrl: string | undefined;
            let emailCommentContent: string | undefined;
            let emailTargetPath: string | undefined;

            if (targetType === "album") {
              emailTargetTitle =
                (album as MaybeAlbum | undefined)?.title || undefined;
              emailThumbnailUrl = getAlbumThumbnailUrl(album as MaybeAlbum);
            } else if (targetType === "image" || targetType === "video") {
              emailTargetTitle = getMediaTitle(media as MaybeMedia);
              emailThumbnailUrl = getMediaThumbnailUrl(media as MaybeMedia);
            } else if (targetType === "comment") {
              emailTargetType = "comment";
              emailCommentContent = comment?.content || undefined;
              emailTargetTitle = getCommentSnippet(comment as MaybeComment);

              if (comment?.targetType && comment?.targetId) {
                emailTargetId = comment.targetId;
                emailTargetPath =
                  comment.targetType === "album"
                    ? `albums/${comment.targetId}`
                    : `media/${comment.targetId}`;
              }
            }

            if (!emailTargetTitle) {
              emailTargetTitle =
                emailTargetType === "album"
                  ? "your album"
                  : emailTargetType === "image"
                  ? "your image"
                  : emailTargetType === "video"
                  ? "your video"
                  : emailCommentContent
                  ? getCommentSnippet(comment as MaybeComment) || "your comment"
                  : "your comment";
            }

            const emailResult = await EmailService.sendLikeNotificationEmail({
              to: targetUser.email,
              username: targetUser.username,
              actorName,
              locale,
              targetType: emailTargetType,
              targetId: emailTargetId,
              targetTitle: emailTargetTitle,
              targetThumbnailUrl: emailThumbnailUrl,
              commentContent: emailCommentContent,
              targetPath: emailTargetPath,
            });

            if (emailResult.success) {
              console.log("📧 Sent like notification email", {
                targetCreatorId,
                targetId,
              });
            } else {
              console.warn("⚠️ Like notification email send failed", {
                targetCreatorId,
                targetId,
                error: emailResult.error,
              });
            }
          }
        } catch (error) {
          console.warn("⚠️ Failed to send like notification email", {
            targetCreatorId,
            targetId,
            error,
          });
        }
      }
    }

    // PSC Payout Integration for likes (immediate payout)
    if (targetCreatorId && userId !== targetCreatorId) {
      try {
        let pscTargetType: "album" | "image" | "video" | "profile";
        let pscTargetId: string;
        const pscMetadata: any = {};

        if (targetType === "comment") {
          // For comments, we need to get the parent content (album/media) for PSC
          if (comment?.targetType && comment?.targetId) {
            pscTargetType = comment.targetType as "album" | "image" | "video";
            pscTargetId = comment.targetId;
            pscMetadata.commentId = targetId;
            if (comment.targetType === "album") {
              pscMetadata.albumId = comment.targetId;
            } else if (
              comment.targetType === "image" ||
              comment.targetType === "video"
            ) {
              pscMetadata.mediaId = comment.targetId;
            }
          } else {
            console.warn(
              "⚠️ Comment missing targetType/targetId, skipping PSC payout"
            );
            // Skip PSC payout but continue with the response
          }
        } else {
          // For albums and media, use directly
          pscTargetType = targetType as "album" | "image" | "video";
          pscTargetId = targetId;
          if (targetType === "album") {
            pscMetadata.albumId = targetId;
          } else {
            pscMetadata.mediaId = targetId;
          }
        }

        // Only process payout if we have valid target info
        if (pscTargetType! && pscTargetId!) {
          const payoutEvent = PSCIntegrationService.createPayoutEvent(
            "like",
            pscTargetType,
            pscTargetId,
            userId,
            targetCreatorId,
            pscMetadata
          );

          pscPayoutResult =
            await PSCIntegrationService.processInteractionPayout(
              payoutEvent,
              true // Likes require auth
            );

          if (pscPayoutResult.success && pscPayoutResult.shouldPayout) {
            console.log(
              `💰 PSC Payout: ${pscPayoutResult.amount} PSC to ${targetCreatorId} for ${targetType} like`
            );
          }
        }
      } catch (error) {
        console.warn("⚠️ PSC payout failed:", error);
        // Don't fail the entire request if PSC payout fails
      }
    }

    console.log(`✅ Like added for ${targetType} ${targetId}`);
  } else {
    // Remove like - use different method for comments
    if (targetType === "comment") {
      await DynamoDBService.deleteUserInteractionForComment(
        userId,
        "like",
        targetId
      );
    } else {
      await DynamoDBService.deleteUserInteraction(userId, "like", targetId);
    }

    // Decrement like count for the target using shared utility
    if (targetType === "album") {
      await CounterUtil.incrementAlbumLikeCount(targetId, -1);

      // Get album creator and decrement their totalLikesReceived metric
      const album = await DynamoDBService.getAlbum(targetId);
      if (album?.createdBy) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            album.createdBy,
            "totalLikesReceived",
            -1
          );
          console.log(
            `📉 Decremented totalLikesReceived for album creator: ${album.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to decrement totalLikesReceived for user ${album.createdBy}:`,
            error
          );
        }
      }
    } else if (targetType === "image" || targetType === "video") {
      await CounterUtil.incrementMediaLikeCount(targetId, -1);

      // Get media creator and decrement their totalLikesReceived metric
      const media = await DynamoDBService.getMedia(targetId);
      if (media?.createdBy) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            media.createdBy,
            "totalLikesReceived",
            -1
          );
          console.log(
            `📉 Decremented totalLikesReceived for media creator: ${media.createdBy}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to decrement totalLikesReceived for user ${media.createdBy}:`,
            error
          );
        }
      }
    } else if (targetType === "comment") {
      await CounterUtil.incrementCommentLikeCount(targetId, -1);

      // Get comment creator and decrement their totalLikesReceived metric
      const comment = await DynamoDBService.getComment(targetId);
      if (comment?.userId) {
        try {
          await DynamoDBService.incrementUserProfileMetric(
            comment.userId,
            "totalLikesReceived",
            -1
          );
          console.log(
            `📉 Decremented totalLikesReceived for comment creator: ${comment.userId}`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to decrement totalLikesReceived for user ${comment.userId}:`,
            error
          );
        }
      }
    }

    console.log(`✅ Like removed for ${targetType} ${targetId}`);
  }

  return ResponseUtil.success(event, {
    userId: userId,
    interactionType: "like",
    targetType,
    targetId,
    action: action === "add" ? "added" : "removed",
    psc: pscPayoutResult
      ? {
          success: pscPayoutResult.success,
          amount: pscPayoutResult.amount,
          shouldPayout: pscPayoutResult.shouldPayout,
          reason: pscPayoutResult.reason,
        }
      : null,
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleLikeInteraction, {
  requireBody: true,
});
