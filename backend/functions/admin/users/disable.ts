import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { DisableUserRequest } from "@shared";

/**
 * @fileoverview Admin User Disable Handler
 * @description Disables a user account by setting isActive to false and deleting all active sessions for immediate logout.
 * @auth Requires admin authentication.
 * @body DisableUserRequest: { userId: string }
 * @notes
 * - Validates userId presence.
 * - Verifies user existence and checks if already inactive.
 * - Updates user entity in DynamoDB.
 * - Calls deleteUserSessionsByUserId to invalidate all sessions.
 * - Returns updated user info without sensitive data.
 * - Logs for auditing.
 */
const handleAdminUserDisable = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/users/disable handler called");

  try {
    // Parse request body
    const request: DisableUserRequest = LambdaHandlerUtil.parseJsonBody(event);

    // Validate userId
    const userId = ValidationUtil.validateRequiredString(
      request.userId,
      "userId"
    );

    console.log(`📋 Admin requesting to disable user: ${userId}`);

    // Get user to verify it exists
    const userEntity = await DynamoDBService.getUserById(userId);
    if (!userEntity) {
      console.log("❌ User not found:", userId);
      return ResponseUtil.notFound(event, "User not found");
    }

    // Check if user is already inactive
    if (!userEntity.isActive) {
      console.log("ℹ️ User already inactive:", userId);
      return ResponseUtil.success(event, {
        message: "User is already inactive",
        user: userEntity,
      });
    }

    // Update user to set isActive = false
    await DynamoDBService.updateUser(userId, {
      isActive: false,
    });

    // Delete all active sessions for this user
    await DynamoDBService.deleteUserSessionsByUserId(userId);

    console.log(
      `✅ Admin successfully disabled user ${userId} and deleted active sessions`
    );

    return ResponseUtil.success(event, {
      message: "User has been disabled successfully",
      user: {
        userId: userEntity.userId,
        username: userEntity.username,
        email: userEntity.email,
        isActive: false,
      },
    });
  } catch (error) {
    console.error("❌ Error disabling user:", error);
    return ResponseUtil.internalError(event, "Failed to disable user");
  }
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleAdminUserDisable);
