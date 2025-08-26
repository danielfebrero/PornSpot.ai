import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
/**
 * List all users for admin management
 */
const handleAdminUsersList = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/users/list handler called");

  try {
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
        error instanceof Error
          ? error.message
          : "Invalid pagination parameters";
      return ResponseUtil.badRequest(event, errorMessage);
    }

    const { cursor: lastEvaluatedKey, limit } = paginationParams;

    console.log(`📋 Admin requesting user list, limit: ${limit}`);

    // Query all users using getAllUsers
    const result = await DynamoDBService.getAllUsers(limit, lastEvaluatedKey);

    console.log(`✅ Admin retrieved ${result.users.length} users`);

    // Build typed paginated payload
    const payload = PaginationUtil.createPaginatedResponse(
      "users",
      result.users,
      result.lastEvaluatedKey,
      limit
    );

    return ResponseUtil.success(event, payload);
  } catch (error) {
    console.error("❌ Error listing users:", error);
    return ResponseUtil.internalError(event, "Failed to retrieve users list");
  }
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleAdminUsersList);
