import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { getPermissionsConfig } from "@shared/utils/permissions";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * Lambda function to serve permissions configuration
 * GET /api/config/permissions
 */
const handleGetPermissions = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("📋 Serving permissions configuration");

  // Get permissions from shared utility
  const permissions = getPermissionsConfig();

  console.log("✅ Permissions configuration served successfully");

  // Return permissions with proper CORS headers
  return ResponseUtil.success(event, permissions);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetPermissions);
