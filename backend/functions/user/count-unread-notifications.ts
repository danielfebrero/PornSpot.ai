import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  LambdaHandlerUtil,
  AuthResult,
} from "../../shared/utils/lambda-handler";
import { DynamoDBService } from "../../shared/utils/dynamodb";
import { ResponseUtil } from "../../shared/utils/response";

export const handler = LambdaHandlerUtil.withAuth(
  async (
    event: APIGatewayProxyEvent,
    auth: AuthResult
  ): Promise<APIGatewayProxyResult> => {
    const { userId } = auth;

    try {
      // Handle preflight OPTIONS request
      if (event.httpMethod === "OPTIONS") {
        return ResponseUtil.noContent(event);
      }

      if (event.httpMethod !== "GET") {
        return ResponseUtil.error(event, "Method not allowed", 405);
      }

      // Get unread notification count for the user
      const unreadCount = await DynamoDBService.getUnreadNotificationCount(
        userId
      );

      return ResponseUtil.success(event, {
        unreadCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error getting unread notification count:", error);
      return ResponseUtil.error(
        event,
        "Failed to get unread notification count"
      );
    }
  }
);
