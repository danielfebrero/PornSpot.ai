/*
File objective: Add or remove a like interaction on album, media, or comment.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Validates action ('add'|'remove') and target type; verifies target existence
- Uses single-table interaction entities; distinct SK pattern for comment likes
- Updates per-target like counters and increments/decrements creator's totalLikesReceived
- Idempotency: returns 409 on duplicate like attempts
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { InteractionRequest, UserInteractionEntity, TargetType } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { CounterUtil } from "@shared/utils/counter";

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
  if (!["album", "media", "comment"].includes(targetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album', 'media', or 'comment'"
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
  } else if (targetType === "media") {
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

  const now = new Date().toISOString();

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

    // Create like interaction - use different SK pattern for comments
    const interaction: UserInteractionEntity = {
      PK: `USER#${userId}`,
      SK:
        targetType === "comment"
          ? `COMMENT_INTERACTION#like#${targetId}`
          : `INTERACTION#like#${targetId}`,
      GSI1PK:
        targetType === "comment"
          ? `COMMENT_INTERACTION#like#${targetId}`
          : `INTERACTION#like#${targetId}`,
      GSI1SK: userId,
      EntityType: "UserInteraction",
      userId: userId,
      interactionType: "like",
      targetType: targetType as TargetType,
      targetId,
      createdAt: now,
    };

    await DynamoDBService.createUserInteraction(interaction);

    // Increment like count for the target using shared utility
    if (targetType === "album") {
      await CounterUtil.incrementAlbumLikeCount(targetId, 1);

      // Get album creator and increment their totalLikesReceived metric
      const album = await DynamoDBService.getAlbum(targetId);
      if (album?.createdBy) {
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
    } else if (targetType === "media") {
      await CounterUtil.incrementMediaLikeCount(targetId, 1);

      // Get media creator and increment their totalLikesReceived metric
      const media = await DynamoDBService.getMedia(targetId);
      if (media?.createdBy) {
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
      const comment = await DynamoDBService.getComment(targetId);
      if (comment?.userId) {
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
    } else if (targetType === "media") {
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
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleLikeInteraction, {
  requireBody: true,
});
