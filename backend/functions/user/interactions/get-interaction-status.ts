import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleGetInteractionStatus = async (event: APIGatewayProxyEvent, auth: AuthResult): Promise<APIGatewayProxyResult> => {
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

  if (targets.length > 50) {
    return ResponseUtil.badRequest(
      event,
      "Maximum 50 targets allowed per request"
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

  // Get user interactions for all targets
  const statusMap = new Map<
    string,
    {
      userLiked: boolean;
      userBookmarked: boolean;
      likeCount: number;
      bookmarkCount: number;
    }
  >();

  // Initialize all targets as not interacted
  for (const target of targets) {
    const key = `${target.targetType}:${target.targetId}`;
    statusMap.set(key, {
      userLiked: false,
      userBookmarked: false,
      likeCount: 0,
      bookmarkCount: 0,
    });
  }

  // Separate comment targets from album/media targets
  const albumMediaTargets = targets.filter(
    (t) => t.targetType === "album" || t.targetType === "media"
  );
  const commentTargets = targets.filter((t) => t.targetType === "comment");

  // Get user likes and bookmarks for album/media targets
  const promises: Promise<any>[] = [
    DynamoDBService.getUserInteractions(userId, "like"),
    DynamoDBService.getUserInteractions(userId, "bookmark"),
  ];

  // Add interaction counts for album/media targets
  albumMediaTargets.forEach((target) => {
    promises.push(
      DynamoDBService.getInteractionCounts(
        target.targetType as "album" | "media",
        target.targetId
      )
    );
  });

  // Add comment interaction checks for comment targets
  commentTargets.forEach((target) => {
    promises.push(
      DynamoDBService.getUserInteractionForComment(
        userId,
        "like",
        target.targetId
      )
    );
    promises.push(DynamoDBService.getComment(target.targetId));
  });

  const results = await Promise.all(promises);

  let resultIndex = 0;
  const likesResult = results[resultIndex++];
  const bookmarksResult = results[resultIndex++];

  // Process album/media interaction counts
  albumMediaTargets.forEach((target) => {
    const key = `${target.targetType}:${target.targetId}`;
    const status = statusMap.get(key)!;
    const counts = results[resultIndex++];
    if (counts) {
      status.likeCount = counts.likeCount;
      status.bookmarkCount = counts.bookmarkCount;
      statusMap.set(key, status);
    }
  });

  // Process comment interactions
  commentTargets.forEach((target) => {
    const key = `${target.targetType}:${target.targetId}`;
    const status = statusMap.get(key)!;

    const userInteraction = results[resultIndex++];
    const comment = results[resultIndex++];

    status.userLiked = userInteraction !== null;
    status.likeCount = comment?.likeCount || 0;
    // Comments don't have bookmarks, so bookmark count stays 0
    statusMap.set(key, status);
  });

  // Process likes for album/media targets
  if (likesResult.interactions) {
    for (const interaction of likesResult.interactions) {
      const key = `${interaction.targetType}:${interaction.targetId}`;
      if (statusMap.has(key)) {
        const status = statusMap.get(key)!;
        status.userLiked = true;
        statusMap.set(key, status);
      }
    }
  }

  // Process bookmarks for album/media targets
  if (bookmarksResult.interactions) {
    for (const interaction of bookmarksResult.interactions) {
      const key = `${interaction.targetType}:${interaction.targetId}`;
      if (statusMap.has(key)) {
        const status = statusMap.get(key)!;
        status.userBookmarked = true;
        statusMap.set(key, status);
      }
    }
  }

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
