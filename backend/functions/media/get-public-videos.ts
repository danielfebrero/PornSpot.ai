import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import type { Media } from "@shared/shared-types";

/**
 * @fileoverview Public Videos Retrieval Handler
 * @description Streams all public video media from DynamoDB for sitemap generation and batch jobs.
 * @notes
 * - Iterates through GSI5 to gather every isPublic=true video.
 * - Returns Media[] payload consistent with existing media fetch endpoints.
 */
const BATCH_SIZE = 100;

const handleGetPublicVideos = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const videos: Media[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const { media, lastEvaluatedKey: nextKey } =
        await DynamoDBService.getAllPublicVideos(BATCH_SIZE, lastEvaluatedKey);

      if (media.length > 0) {
        videos.push(...media);
      }

      lastEvaluatedKey = nextKey;
    } while (lastEvaluatedKey);

    return ResponseUtil.success(event, videos);
  } catch (error) {
    console.error("Failed to fetch public videos", error);
    return ResponseUtil.internalError(event, "Failed to fetch public videos");
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetPublicVideos);
