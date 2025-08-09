import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { UserUtil } from "@shared/utils/user";
import { EmailService } from "@shared/utils/email";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface ResendVerificationRequest {
  email: string;
}

const handleResendVerification = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const request: ResendVerificationRequest = JSON.parse(event.body!);

  // Validate email using shared validation
  const email = ValidationUtil.validateEmail(request.email);

  // Always return the same response for security, regardless of whether email exists
  const standardResponse = {
    message:
      "If the email exists in our system, a verification email has been sent.",
  };

  // Get user by email
  const userEntity = await DynamoDBService.getUserByEmail(email);

  // If user doesn't exist, just return the standard response
  if (!userEntity) {
    console.log(
      "Resend verification attempt for non-existent email:",
      email
    );
    return ResponseUtil.success(event, standardResponse);
  }

  // If user is disabled, still return standard response to avoid revealing account status
  if (!userEntity.isActive) {
    console.log(
      "Resend verification attempt for disabled account:",
      userEntity.userId
    );
    return ResponseUtil.success(event, standardResponse);
  }

  // If email is already verified, still return standard response
  if (userEntity.isEmailVerified) {
    console.log(
      "Resend verification attempt for already verified email:",
      userEntity.userId
    );
    return ResponseUtil.success(event, standardResponse);
  }

  // Note: Rate limiting implementation is simplified for now
  // In production, implement proper rate limiting with Redis or DynamoDB TTL
  console.log("Sending verification email for user:", userEntity.userId);

  // Generate new verification token
  const verificationToken = await UserUtil.generateEmailVerificationToken(
    userEntity.userId,
    userEntity.email
  );

  // Send verification email
  try {
    const emailResult = await EmailService.sendVerificationEmail(
      userEntity.email,
      verificationToken,
      userEntity.firstName
    );

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      // Still return standard response to avoid revealing system errors
      return ResponseUtil.success(event, standardResponse);
    }

    console.log("Verification email resent successfully:", {
      messageId: emailResult.messageId,
      email: userEntity.email,
      userId: userEntity.userId,
    });
  } catch (error) {
    console.error("Email sending error:", error);
    // Still return standard response to avoid revealing system errors
    return ResponseUtil.success(event, standardResponse);
  }

  // Always return the same response regardless of the actual outcome
  return ResponseUtil.success(event, standardResponse);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleResendVerification, {
  requireBody: true,
});
