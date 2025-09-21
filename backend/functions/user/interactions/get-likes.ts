import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handleGetLikes = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const requestingUserId = auth.userId;
  console.log("✅ Authenticated user:", requestingUserId);

  // Check if we're querying for a specific user's likes
  const queryParams = event.queryStringParameters || {};
  const targetUsername = queryParams["user"];
  const includeContentPreview = queryParams["includeContentPreview"] === "true";

  let targetUserId = requestingUserId; // Default to requesting user's own likes

  if (targetUsername) {
    // Look up the target user by username
    const targetUser = await DynamoDBService.getUserByUsername(targetUsername);
    if (!targetUser) {
      return ResponseUtil.notFound(event, "User not found");
    }
    targetUserId = targetUser.userId;
  }

  // Parse pagination parameters using unified utility
  let paginationParams;
  try {
    paginationParams = PaginationUtil.parseRequestParams(
      event.queryStringParameters as Record<string, string> | null,
      DEFAULT_PAGINATION_LIMITS.interactions,
      MAX_PAGINATION_LIMITS.interactions
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid pagination parameters";
    return ResponseUtil.badRequest(event, errorMessage);
  }

  const { cursor: lastEvaluatedKey, limit } = paginationParams;

  // Get user's likes from DynamoDB
  const result = await DynamoDBService.getUserInteractions(
    targetUserId,
    "like",
    limit,
    lastEvaluatedKey,
    false
  );

  const { interactions } = result;

  // Get target details for each interaction
  const enrichedInteractions = await Promise.all(
    interactions.map(async (interaction) => {
      let targetDetails = null;

      if (interaction.targetType === "album") {
        targetDetails = await DynamoDBService.getAlbum(interaction.targetId);
        if (includeContentPreview) {
          targetDetails = {
            ...targetDetails,
            contentPreview: await DynamoDBService.getContentPreviewForAlbum(
              interaction.targetId
            ),
          };
        }
      } else if (
        interaction.targetType === "image" ||
        interaction.targetType === "video"
      ) {
        // For media, get the media details directly
        targetDetails = await DynamoDBService.getMedia(interaction.targetId);
      }

      return {
        ...interaction,
        target: targetDetails,
      };
    })
  );

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "interactions",
    enrichedInteractions,
    result.lastEvaluatedKey,
    limit
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withAuth(handleGetLikes);
