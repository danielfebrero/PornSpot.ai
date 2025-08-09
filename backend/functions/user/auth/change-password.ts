import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { UserAuthUtil } from "@shared/utils/user-auth";
import * as bcrypt from "bcrypt";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordResponse {
  message: string;
}

const handleChangePassword = async (event: APIGatewayProxyEvent, auth: AuthResult): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/auth/change-password handler called");
  
  // Only allow PUT method
  if (event.httpMethod !== "PUT") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only PUT method allowed");
  }

  const userId = auth.userId;
  console.log(`✅ User session valid: ${userId}`);

  // Get full user entity to access password information
  console.log("📋 Fetching user authentication details...");
  const userEntity = await DynamoDBService.getUserById(userId);

  if (!userEntity) {
    console.log("❌ User entity not found");
    return ResponseUtil.unauthorized(event, "User not found");
  }

  // Check if user has a password (not OAuth user)
  if (userEntity.googleId) {
    console.log("❌ OAuth user cannot change password");
    return ResponseUtil.badRequest(
      event,
      "OAuth users cannot change password. Manage your password through your OAuth provider."
    );
  }

  if (!userEntity.passwordHash) {
    console.log("❌ User has no password set");
    return ResponseUtil.badRequest(
      event,
      "No password is set for this account"
    );
  }

  // Parse request body
  const requestData: ChangePasswordRequest = JSON.parse(event.body!);

  // Validate required fields using shared validation
  const currentPassword = ValidationUtil.validateRequiredString(requestData.currentPassword, "Current password");
  const newPassword = ValidationUtil.validatePassword(requestData.newPassword);

  // Password strength validation (same as registration)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    console.log("❌ New password doesn't meet requirements");
    return ResponseUtil.badRequest(
      event,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    );
  }

  // Verify current password
  console.log("🔓 Verifying current password...");
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    userEntity.passwordHash!
  );

  if (!isCurrentPasswordValid) {
    console.log("❌ Current password is incorrect");
    return ResponseUtil.badRequest(event, "Current password is incorrect");
  }

  // Hash new password
  console.log("🔐 Hashing new password...");
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password in database
  console.log("💾 Updating password in database...");
  await DynamoDBService.updateUser(userId, {
    passwordHash: newPasswordHash,
  });

  console.log("✅ Password changed successfully");

  const response: ChangePasswordResponse = {
    message: "Password changed successfully",
  };

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handleChangePassword, {
  requireBody: true,
});
