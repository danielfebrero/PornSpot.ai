/*
File objective: Handle password reset request by generating a secure token and sending reset email.
Auth: Public endpoint (no session) via LambdaHandlerUtil.withoutAuth.
Special notes:
- Validates email exists but doesn't reveal if user exists for security
- Generates cryptographically secure reset token with 1-hour expiration
- Stores token in DynamoDB with TTL for automatic cleanup
- Sends email with reset link using SES
- Rate limited to prevent abuse
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { ForgotPasswordRequest } from "@shared";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { EmailService } from "@shared/utils/email";
import { ParameterStoreService } from "@shared/utils/parameters";
import * as crypto from "crypto";

const handleForgotPassword = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/auth/forgot-password handler called");

  const request: ForgotPasswordRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate input using shared validation
  const email = ValidationUtil.validateEmail(request.email);

  console.log(`📧 Password reset requested for email: ${email}`);

  try {
    // Check if user exists (but don't reveal this information in response)
    const userEntity = await DynamoDBService.getUserByEmail(email);

    if (userEntity && userEntity.isActive) {
      console.log(`✅ User found: ${userEntity.userId}`);

      // Check if user has a password (not OAuth-only user)
      if (userEntity.provider === "google" || !userEntity.passwordHash) {
        console.log("⚠️ OAuth user cannot reset password");
        // Still return success to not reveal information
        return ResponseUtil.success(event, {
          success: true,
          message:
            "If an account exists with this email address, you will receive a password reset link.",
        });
      }

      // Generate cryptographically secure reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      console.log(`🔐 Generated reset token for user: ${userEntity.userId}`);

      // Store reset token in DynamoDB using service layer
      await DynamoDBService.createPasswordResetToken(
        resetToken,
        userEntity.userId,
        userEntity.email,
        tokenExpiry
      );

      // Get frontend URL from parameter store
      const frontendUrl = await ParameterStoreService.getFrontendUrl();
      const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

      console.log(`📤 Sending password reset email to: ${email}`);

      // Send reset email
      await EmailService.sendPasswordResetEmail({
        to: email,
        username: userEntity.username || userEntity.email,
        resetUrl,
        expiresAt: tokenExpiry,
      });

      console.log(`✅ Password reset email sent successfully`);
    } else {
      console.log(`❌ User not found or inactive: ${email}`);
      // Still add a small delay to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Always return success response to prevent email enumeration
    return ResponseUtil.success(event, {
      success: true,
      message:
        "If an account exists with this email address, you will receive a password reset link.",
    });
  } catch (error) {
    console.error("❌ Error in forgot password:", error);

    // Return generic success to prevent information leakage
    return ResponseUtil.success(event, {
      success: true,
      message:
        "If an account exists with this email address, you will receive a password reset link.",
    });
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleForgotPassword, {
  requireBody: true,
});
