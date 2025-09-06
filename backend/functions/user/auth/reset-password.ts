/*
File objective: Handle password reset completion with token validation and new password setting.
Auth: Public endpoint (no session) via LambdaHandlerUtil.withoutAuth; creates session on success.
Special notes:
- Validates reset token exists and is not expired
- Validates new password meets requirements
- Updates user password with bcrypt hashing
- Automatically logs user in on successful reset
- Cleans up used reset token for security
*/
/**
 * @fileoverview Password Reset Handler
 * @description Completes password reset by validating token, updating password, and logging in user.
 * @auth Public via LambdaHandlerUtil.withoutAuth; creates session on success.
 * @body ResetPasswordRequest: { token: string, newPassword: string }
 * @notes
 * - Validates token and new password strength.
 * - Checks token expiry and user status.
 * - Hashes new password with bcrypt (salt 12).
 * - Updates user and deletes used token.
 * - Creates session with auto-login.
 * - Returns success message and session cookie.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { ResetPasswordRequest } from "@shared";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { SessionUtil } from "@shared/utils/session";
import * as bcrypt from "bcrypt";

const handleResetPassword = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/auth/reset-password handler called");

  const request: ResetPasswordRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate input using shared validation
  const token = ValidationUtil.validateRequiredString(request.token, "token");
  const newPassword = ValidationUtil.validatePassword(request.newPassword);

  console.log(
    `🔐 Password reset attempted with token: ${token.substring(0, 8)}...`
  );

  try {
    // Get the reset token from DynamoDB using service layer
    const tokenEntity = await DynamoDBService.getPasswordResetToken(token);

    if (!tokenEntity) {
      console.log("❌ Reset token not found");
      return ResponseUtil.badRequest(event, "Invalid or expired reset token");
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(tokenEntity.expiresAt);

    if (now > expiresAt) {
      console.log("❌ Reset token expired");

      // Clean up expired token using service layer
      await DynamoDBService.deletePasswordResetToken(token);

      return ResponseUtil.badRequest(event, "Reset token has expired");
    }

    console.log(`✅ Valid reset token found for user: ${tokenEntity.userId}`);

    // Get the user to update their password
    const userEntity = await DynamoDBService.getUserById(tokenEntity.userId);

    if (!userEntity || !userEntity.isActive) {
      console.log("❌ User not found or inactive");
      return ResponseUtil.badRequest(event, "Invalid reset token");
    }

    // Password strength validation (same as registration)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      console.log("❌ New password doesn't meet requirements");
      return ResponseUtil.badRequest(
        event,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      );
    }

    // Hash new password
    console.log("🔐 Hashing new password...");
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    console.log("💾 Updating password in database...");
    await DynamoDBService.updateUser(tokenEntity.userId, {
      passwordHash: newPasswordHash,
    });

    // Clean up used reset token using service layer
    console.log("🧹 Cleaning up used reset token...");
    await DynamoDBService.deletePasswordResetToken(token);

    console.log("✅ Password reset successful, creating user session...");

    // Create user session with auto sign-in (same as login)
    return SessionUtil.createUserSessionResponse(
      event,
      {
        userId: userEntity.userId,
        userEmail: userEntity.email,
        updateLastLogin: true,
      },
      "Password reset successful. You are now logged in."
    );
  } catch (error) {
    console.error("❌ Error in reset password:", error);
    return ResponseUtil.error(event, "Failed to reset password");
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleResetPassword, {
  requireBody: true,
});
