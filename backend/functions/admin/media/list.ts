import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import {
  LambdaHandlerUtil,
  AdminAuthResult,
} from "@shared/utils/lambda-handler";

const handleListMedia = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.admin,
      MAX_PAGINATION_LIMITS.admin
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  // Get all media across all users - admin view
  const { media, nextKey } = await DynamoDBService.listAllMedia(
    limit,
    lastEvaluatedKey
  );

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "media",
    media,
    nextKey,
    limit
  );

  console.log(`🔍 Admin ${auth.username} listed ${media.length} media items`);

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleListMedia);
