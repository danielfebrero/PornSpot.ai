/*
File objective: Bulk-fetch view counts for albums and media by IDs.
Auth: Public endpoint via LambdaHandlerUtil.withoutAuth.
Special notes:
- Accepts up to 100 targets in request body; validates each target
- Reads current viewCount for each item; returns 0 on per-item failure instead of failing request
- Designed for client-side batching to reduce round-trips
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleGetViewCount = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔄 Get view count function called");

  // Parse request body for bulk view count fetch
  let targets: Array<{
    targetType: "album" | "media";
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

  // Limit the number of targets to prevent abuse
  if (targets.length > 100) {
    return ResponseUtil.badRequest(
      event,
      "Cannot request view counts for more than 100 items at once"
    );
  }

  // Validate each target using shared validation
  for (const target of targets) {
    try {
      ValidationUtil.validateRequiredString(target.targetId, "targetId");
      ValidationUtil.validateEnum(
        target.targetType,
        ["album", "media"] as const,
        "targetType"
      );
    } catch (error) {
      return ResponseUtil.badRequest(
        event,
        error instanceof Error ? error.message : "Invalid target"
      );
    }
  }

  console.log(
    `📊 Fetching view counts for ${targets.length} targets:`,
    targets.map((t) => `${t.targetType}:${t.targetId}`).join(", ")
  );

  // Fetch view counts for all targets
  const viewCounts = await Promise.all(
    targets.map(async (target) => {
      try {
        let viewCount = 0;

        if (target.targetType === "album") {
          const album = await DynamoDBService.getAlbum(target.targetId);
          viewCount = album?.viewCount || 0;
        } else if (target.targetType === "media") {
          const media = await DynamoDBService.getMedia(target.targetId);
          viewCount = media?.viewCount || 0;
        }

        return {
          targetType: target.targetType,
          targetId: target.targetId,
          viewCount,
        };
      } catch (error) {
        console.warn(
          `⚠️ Failed to get view count for ${target.targetType}:${target.targetId}:`,
          error
        );
        // Return 0 for failed lookups instead of failing the entire request
        return {
          targetType: target.targetType,
          targetId: target.targetId,
          viewCount: 0,
        };
      }
    })
  );

  console.log(
    `✅ Successfully fetched view counts for ${viewCounts.length} targets`
  );

  return ResponseUtil.success(event, {
    viewCounts,
  });
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetViewCount, {
  requireBody: true,
});
