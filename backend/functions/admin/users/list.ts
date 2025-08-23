import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { PaginationUtil } from "@shared/utils/pagination";

/**
 * List all users for admin management
 */
const handleAdminUsersList = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/users/list handler called");

  try {
    // Get pagination parameters
    const limit = parseInt(event.queryStringParameters?.["limit"] || "50");
    const lastEvaluatedKey = event.queryStringParameters?.["lastEvaluatedKey"]
      ? JSON.parse(
          decodeURIComponent(event.queryStringParameters["lastEvaluatedKey"])
        )
      : undefined;

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
