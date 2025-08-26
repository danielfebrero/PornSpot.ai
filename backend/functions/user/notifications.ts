/*
File objective: Get user notifications (automatically marks them as read).
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Returns paginated notifications ordered by newest first
- Automatically marks unread notifications as read when fetched
- Enriches notifications with source username and target details
- For comment notifications: includes commentTargetType and commentTargetId
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { PaginationUtil } from "@shared/utils/pagination";

const handleNotifications = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  console.log("🔔 Notifications function called");

  // Route based on HTTP method
  switch (event.httpMethod) {
    case "GET":
      return await getNotifications(event, userId);
    default:
      return ResponseUtil.error(event, "Method not allowed", 405);
  }
};

async function getNotifications(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};

    const limit = queryParams["limit"]
      ? Math.min(parseInt(queryParams["limit"]), 50) // Max 50 notifications
      : 20; // Default 20

    const cursor = queryParams["cursor"] || undefined;

    // Validate limit
    if (isNaN(limit) || limit < 1) {
      return ResponseUtil.badRequest(event, "limit must be a positive number");
    }

    console.log(`📋 Getting notifications for user ${userId}, limit: ${limit}`);

    // Get notifications from DynamoDB (automatically marks as read)
    const result = await DynamoDBService.getNotificationsForUser(
      userId,
      limit,
      cursor
    );

    console.log(`✅ Retrieved ${result.notifications.length} notifications`);

    // Build typed paginated payload
    const payload = PaginationUtil.createPaginatedResponse(
      "notifications",
      result.notifications,
      result.lastEvaluatedKey,
      limit
    );

    return ResponseUtil.success(event, payload);
  } catch (error) {
    console.error("Error getting notifications:", error);
    return ResponseUtil.error(event, "Failed to get notifications", 500);
  }
}

export const handler = LambdaHandlerUtil.withAuth(handleNotifications, {
  requireBody: false,
});
