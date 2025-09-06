/**
 * @fileoverview Admin Albums Listing Handler
 * @description Retrieves a paginated list of all albums (public and private) for administrative purposes.
 * @auth Requires admin authentication.
 * @queryParams Supports pagination: limit (default/max per admin limits), cursor (lastEvaluatedKey).
 * @notes
 * - Uses unified PaginationUtil for parameter parsing and response formatting.
 * - Queries DynamoDB for albums without visibility filters (admin view).
 * - Returns paginated response with albums array and next cursor if applicable.
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

const handleListAlbums = async (
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

  // Get all albums (including private ones) - admin view
  const { albums, lastEvaluatedKey: nextKey } =
    await DynamoDBService.listAlbums(limit, lastEvaluatedKey);

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "albums",
    albums,
    nextKey,
    limit
  );

  console.log(`🔍 Admin ${auth.username} listed ${albums.length} albums`);

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleListAlbums);
