import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handleGetBookmarks = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔄 Get user bookmarks function called");

  // Users can only query their own bookmarks
  const userId = auth.userId;

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
  const includeContentPreview =
    event.queryStringParameters?.["includeContentPreview"] === "true";

  // Get user bookmarks
  const result = await DynamoDBService.getUserInteractions(
    userId,
    "bookmark",
    limit,
    lastEvaluatedKey
  );

  // Get target details for each interaction
  const enrichedInteractions = await Promise.all(
    result.interactions.map(async (interaction) => {
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

  // Filter out bookmarks to private content or deleted content
  // Users can only see bookmarks to public content, even if they bookmarked it when it was public
  const filteredInteractions = enrichedInteractions.filter((interaction) => {
    // Exclude deleted content
    if (!interaction.target) {
      return false;
    }
    // Exclude private content
    return (
      interaction.target.isPublic === true ||
      interaction.target.createdBy === userId
    );
  });

  // Build typed paginated payload
  const payload = PaginationUtil.createPaginatedResponse(
    "interactions",
    filteredInteractions,
    result.lastEvaluatedKey,
    limit
  );

  return ResponseUtil.success(event, payload);
};

export const handler = LambdaHandlerUtil.withAuth(handleGetBookmarks);
