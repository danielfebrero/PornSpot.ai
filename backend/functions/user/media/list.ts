import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { Media } from "@shared";
import { UserAuthUtil } from "@shared/utils/user-auth";

const handleListUserMedia = async (event: APIGatewayProxyEvent, auth: AuthResult): Promise<APIGatewayProxyResult> => {
  const userId = auth.userId;
  console.log("✅ Authenticated user:", userId);

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.media,
      MAX_PAGINATION_LIMITS.media
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  // Get user's media
  const { media, nextKey } = await DynamoDBService.getUserMedia(
    userId,
    limit,
    lastEvaluatedKey
  );

  // Convert MediaEntity to Media using shared helper
  const mediaResponse: Media[] = media.map((item) =>
    DynamoDBService.convertMediaEntityToMedia(item)
  );

  // Create pagination metadata using unified utility
  const paginationMeta = PaginationUtil.createPaginationMeta(nextKey, limit);

  return ResponseUtil.success(event, {
    media: mediaResponse,
    pagination: paginationMeta,
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleListUserMedia);
