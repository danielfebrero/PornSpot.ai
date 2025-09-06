import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { EnableUserRequest } from "@shared";

/**
 * @fileoverview Admin User Enable Handler
 * @description Enables a previously disabled user account by setting isActive to true.
 * @auth Requires admin authentication.
 * @body EnableUserRequest: { userId: string }
 * @notes
 * - Validates userId presence.
 * - Verifies user existence and checks if already active.
 * - Updates user entity in DynamoDB.
 * - Returns updated user info including isActive=true.
 * - No session creation or management (user must login again).
 * - Logs for auditing.
 */
const handleAdminUserEnable = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/users/enable handler called");

  try {
    // Parse request body
    const request: EnableUserRequest = LambdaHandlerUtil.parseJsonBody(event);

    // Validate userId
    const userId = ValidationUtil.validateRequiredString(
      request.userId,
      "userId"
    );

    console.log(`📋 Admin requesting to enable user: ${userId}`);

    // Get user to verify it exists
    const userEntity = await DynamoDBService.getUserById(userId);
    if (!userEntity) {
      console.log("❌ User not found:", userId);
      return ResponseUtil.notFound(event, "User not found");
    }

    // Check if user is already active
    if (userEntity.isActive) {
      console.log("ℹ️ User already active:", userId);
      return ResponseUtil.success(event, {
        message: "User is already active",
        user: {
          userId: userEntity.userId,
          username: userEntity.username,
          email: userEntity.email,
          isActive: userEntity.isActive,
        },
      });
    }

    // Update user to set isActive = true
    await DynamoDBService.updateUser(userId, {
      isActive: true,
    });

    console.log(`✅ Admin successfully enabled user ${userId}`);

    return ResponseUtil.success(event, {
      message: "User has been enabled successfully",
      user: {
        ...userEntity,
        isActive: true,
      },
    });
  } catch (error) {
    console.error("❌ Error in admin user enable:", error);
    return ResponseUtil.error(event, "Failed to enable user");
  }
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleAdminUserEnable);
