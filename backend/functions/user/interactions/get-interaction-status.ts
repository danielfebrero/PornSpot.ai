/*
File objective: Batch resolve a user's like/bookmark status and counts for targets.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Accepts up to 50 targets; supports album, media, and comment types
- Aggregates user interactions and target counters in parallel for efficiency
- For comments: only like status/count is relevant (no bookmarks)
- Returns per-target object with userLiked, userBookmarked, likeCount, bookmarkCount
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleGetInteractionStatus = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔄 Get user interaction status function called");

  const userId = auth.userId;

  // Parse request body for bulk status check
  let targets: Array<{
    targetType: "album" | "media" | "comment";
    targetId: string;
  }> = [];

  if (event.body) {
    const body = JSON.parse(event.body);
    targets = body.targets || [];
  }

  // Validate targets
  if (!Array.isArray(targets) || targets.length === 0) {
    return ResponseUtil.badRequest(
      event,
      "targets array is required and must not be empty"
    );
  }

  if (targets.length > 500) {
    return ResponseUtil.badRequest(
      event,
      "Maximum 500 targets allowed per request"
    );
  }

  // Validate each target using shared validation
  for (const target of targets) {
    try {
      ValidationUtil.validateEnum(
        target.targetType,
        ["album", "media", "comment"] as const,
        "targetType"
      );
      ValidationUtil.validateRequiredString(target.targetId, "targetId");
    } catch (error) {
      return ResponseUtil.badRequest(
        event,
        error instanceof Error ? error.message : "Invalid target"
      );
    }
  }

  // Separate comment targets from album/media targets
  const albumMediaTargets = targets.filter(
    (t) => t.targetType === "album" || t.targetType === "media"
  );
  const commentTargets = targets.filter((t) => t.targetType === "comment");

  // Build all promises for parallel execution
  const promises: Promise<any>[] = [];
  const promiseMap = new Map<string, { type: string; index: number }>();
  let promiseIndex = 0;

  // For album/media targets: check likes, bookmarks, and get counts
  albumMediaTargets.forEach((target) => {
    const key = `${target.targetType}:${target.targetId}`;

    // Check if user liked this target
    promises.push(
      DynamoDBService.getUserInteraction(userId, "like", target.targetId)
    );
    promiseMap.set(`${key}:like`, {
      type: "interaction",
      index: promiseIndex++,
    });

    // Check if user bookmarked this target
    promises.push(
      DynamoDBService.getUserInteraction(userId, "bookmark", target.targetId)
    );
    promiseMap.set(`${key}:bookmark`, {
      type: "interaction",
      index: promiseIndex++,
    });

    // Get interaction counts for the target
    promises.push(
      DynamoDBService.getInteractionCounts(
        target.targetType as "album" | "media",
        target.targetId
      )
    );
    promiseMap.set(`${key}:counts`, { type: "counts", index: promiseIndex++ });
  });

  // For comment targets: check likes and get comment data
  commentTargets.forEach((target) => {
    const key = `${target.targetType}:${target.targetId}`;

    // Check if user liked this comment
    promises.push(
      DynamoDBService.getUserInteractionForComment(
        userId,
        "like",
        target.targetId
      )
    );
    promiseMap.set(`${key}:like`, {
      type: "interaction",
      index: promiseIndex++,
    });

    // Get comment data for like count
    promises.push(DynamoDBService.getComment(target.targetId));
    promiseMap.set(`${key}:comment`, {
      type: "comment",
      index: promiseIndex++,
    });
  });

  // Execute all promises in parallel
  const results = await Promise.all(promises);

  // Build status map from results
  const statusMap = new Map<
    string,
    {
      userLiked: boolean;
      userBookmarked: boolean;
      likeCount: number;
      bookmarkCount: number;
    }
  >();

  // Process album/media targets
  albumMediaTargets.forEach((target) => {
    const key = `${target.targetType}:${target.targetId}`;

    const likeInfo = promiseMap.get(`${key}:like`);
    const bookmarkInfo = promiseMap.get(`${key}:bookmark`);
    const countsInfo = promiseMap.get(`${key}:counts`);

    const userLiked = likeInfo ? results[likeInfo.index] !== null : false;
    const userBookmarked = bookmarkInfo
      ? results[bookmarkInfo.index] !== null
      : false;
    const counts = countsInfo ? results[countsInfo.index] : null;

    statusMap.set(key, {
      userLiked,
      userBookmarked,
      likeCount: counts?.likeCount || 0,
      bookmarkCount: counts?.bookmarkCount || 0,
    });
  });

  // Process comment targets
  commentTargets.forEach((target) => {
    const key = `${target.targetType}:${target.targetId}`;

    const likeInfo = promiseMap.get(`${key}:like`);
    const commentInfo = promiseMap.get(`${key}:comment`);

    const userLiked = likeInfo ? results[likeInfo.index] !== null : false;
    const comment = commentInfo ? results[commentInfo.index] : null;

    statusMap.set(key, {
      userLiked,
      userBookmarked: false, // Comments don't have bookmarks
      likeCount: comment?.likeCount || 0,
      bookmarkCount: 0, // Comments don't have bookmarks
    });
  });

  // Format response
  const statuses = targets.map((target) => ({
    targetType: target.targetType,
    targetId: target.targetId,
    ...statusMap.get(`${target.targetType}:${target.targetId}`)!,
  }));

  const responseData = {
    statuses,
  };

  console.log("✅ Successfully retrieved interaction statuses");
  return ResponseUtil.success(event, responseData);
};

export const handler = LambdaHandlerUtil.withAuth(handleGetInteractionStatus);
