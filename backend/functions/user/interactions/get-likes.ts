import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { UserAuthMiddleware } from "@shared/auth/user-middleware";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return ResponseUtil.noContent(event);
  }

  try {
    // Get user ID from request context (set by the user authorizer)
    let requestingUserId = event.requestContext.authorizer?.["userId"];

    console.log("👤 RequestingUserId from authorizer:", requestingUserId);

    // Fallback for local development or when authorizer context is missing
    if (!requestingUserId) {
      console.log(
        "⚠️ No userId from authorizer, falling back to session validation"
      );
      const validation = await UserAuthMiddleware.validateSession(event);

      if (!validation.isValid || !validation.user) {
        console.log("❌ Session validation failed");
        return ResponseUtil.unauthorized(event, "No user session found");
      }

      requestingUserId = validation.user.userId;
      console.log(
        "✅ Got requestingUserId from session validation:",
        requestingUserId
      );
    }

    // Check if we're querying for a specific user's likes
    const queryParams = event.queryStringParameters || {};
    const targetUsername = queryParams["user"];

    let targetUserId = requestingUserId; // Default to requesting user's own likes

    if (targetUsername) {
      // Look up the target user by username
      const targetUser = await DynamoDBService.getUserByUsername(
        targetUsername
      );
      if (!targetUser) {
        return ResponseUtil.notFound(event, "User not found");
      }
      targetUserId = targetUser.userId;
    }

    // Get pagination parameters
    const page = parseInt(queryParams["page"] || "1");
    const limit = Math.min(parseInt(queryParams["limit"] || "20"), 100);

    // Calculate offset for pagination
    const lastEvaluatedKey = queryParams["lastKey"]
      ? JSON.parse(decodeURIComponent(queryParams["lastKey"]))
      : undefined;

    // Get user's likes from DynamoDB
    const result = await DynamoDBService.getUserInteractions(
      targetUserId,
      "like",
      limit,
      lastEvaluatedKey
    );

    const { interactions } = result;

    // Get target details for each interaction
    const enrichedInteractions = await Promise.all(
      interactions.map(async (interaction) => {
        let targetDetails = null;

        if (interaction.targetType === "album") {
          const album = await DynamoDBService.getAlbum(interaction.targetId);
          if (album) {
            targetDetails = {
              id: album.id,
              title: album.title,
              coverImageUrl: album.coverImageUrl,
              thumbnailUrls: album.thumbnailUrls,
              mediaCount: album.mediaCount,
              isPublic: album.isPublic,
              viewCount: album.viewCount,
              createdAt: album.createdAt,
              updatedAt: album.updatedAt,
            };
          }
        } else if (interaction.targetType === "media") {
          // For media, get the media details directly
          const media = await DynamoDBService.getMedia(interaction.targetId);
          if (media) {
            targetDetails = {
              id: media.id,
              title: media.originalFilename,
              type: "media",
              mimeType: media.mimeType,
              size: media.size,
              thumbnailUrls: media.thumbnailUrls,
              url: media.url,
              viewCount: media.viewCount,
              createdAt: media.createdAt,
              updatedAt: media.updatedAt,
            };
          } else {
            // If we can't find the media, use basic fallback
            targetDetails = {
              id: interaction.targetId,
              type: "media",
              title: "Unknown Media",
            };
          }
        }

        return {
          ...interaction,
          target: targetDetails,
        };
      })
    );

    // Calculate pagination info
    const hasNext = !!result.lastEvaluatedKey;
    const nextKey = result.lastEvaluatedKey
      ? encodeURIComponent(JSON.stringify(result.lastEvaluatedKey))
      : undefined;

    return ResponseUtil.success(event, {
      interactions: enrichedInteractions,
      pagination: {
        page,
        limit,
        hasNext,
        nextKey,
        total: enrichedInteractions.length, // Note: This is count for current page, not total count
      },
    });
  } catch (error) {
    console.error("❌ Error in get-likes function:", error);
    return ResponseUtil.internalError(event, "Internal server error");
  }
};
