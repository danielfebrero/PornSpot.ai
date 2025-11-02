/**
 * @fileoverview Admin Media Listing Handler
 * @description Retrieves a paginated list of all media items across the platform for administrative review.
 * @auth Requires admin authentication.
 * @queryParams Supports pagination: limit (default/max per admin limits), cursor (lastEvaluatedKey).
 * @notes
 * - Uses unified PaginationUtil for parsing and response formatting.
 * - Queries all media without user or visibility filters (admin view).
 * - Calls DynamoDBService.listAllMedia for comprehensive listing.
 * - Returns paginated payload with media array and next cursor.
 */
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

  // Get optional type filter parameter
  const type = event.queryStringParameters?.["type"] as
    | "image"
    | "video"
    | undefined;

  // Validate type parameter if provided
  if (type && type !== "image" && type !== "video") {
    return ResponseUtil.badRequest(
      event,
      "Invalid type parameter. Must be 'image' or 'video'"
    );
  }

  // Get all media across all users - admin view
  // Use type-filtered query if type is specified, otherwise get all media
  const { media, nextKey } = type
    ? await DynamoDBService.listAllMediaByType(type, limit, lastEvaluatedKey)
    : await DynamoDBService.listAllMedia(limit, lastEvaluatedKey);

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "media",
    media,
    nextKey,
    limit
  );

  console.log(
    `🔍 Admin ${auth.username} listed ${media.length} media items${
      type ? ` (type: ${type})` : ""
    }`
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleListMedia);
