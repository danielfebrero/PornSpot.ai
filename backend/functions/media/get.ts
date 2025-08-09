/*
File objective: List media items within a given album using cursor pagination.
Auth: Public endpoint via LambdaHandlerUtil.withoutAuth.
Special notes:
- Validates album existence before listing
- Uses PaginationUtil with DEFAULT/MAX limits; returns paginated payload with next cursor
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleGetMedia = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const albumId = ValidationUtil.validateRequiredString(
    event.pathParameters?.["albumId"],
    "albumId"
  );

  // Verify album exists
  const album = await DynamoDBService.getAlbum(albumId);
  if (!album) {
    return ResponseUtil.notFound(event, "Album not found");
  }

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
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  const { media, lastEvaluatedKey: nextKey } =
    await DynamoDBService.listAlbumMedia(albumId, limit, lastEvaluatedKey);

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "media",
    media,
    nextKey,
    limit
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetMedia, {
  validatePathParams: ["albumId"],
});
