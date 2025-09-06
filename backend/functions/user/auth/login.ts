/**
 * @fileoverview User Login Handler
 * @description Authenticates user with email/password, verifies credentials, and creates session cookie.
 * @auth Public via LambdaHandlerUtil.withoutAuth; sets session cookie on success.
 * @body UserLoginRequest: { email: string, password: string }
 * @notes
 * - Validates email and password.
 * - Checks user active, email verified; rejects inactive or unverified.
 * - Rejects OAuth users for password login.
 * - Uses bcrypt for password comparison with timing delay on invalid.
 * - Calls SessionUtil.createUserSessionResponse for session creation.
 * - Returns user data and session cookie.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as bcrypt from "bcrypt";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { UserLoginRequest } from "@shared";
import { SessionUtil } from "@shared/utils/session";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleLogin = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const request: UserLoginRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate input using shared validation
  const email = ValidationUtil.validateEmail(request.email);
  const password = ValidationUtil.validateRequiredString(
    request.password,
    "password"
  );

  const userEntity = await DynamoDBService.getUserByEmail(email);

  if (!userEntity) {
    // Add delay to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return ResponseUtil.unauthorized(event, "Invalid email or password");
  }

  if (!userEntity.isActive) {
    return ResponseUtil.forbidden(event, "Invalid email or password");
  }

  // Check if email is verified
  if (!userEntity.isEmailVerified) {
    const errorResponse = ResponseUtil.forbidden(event, "");
    return {
      statusCode: 403,
      headers: errorResponse.headers,
      body: JSON.stringify({
        success: false,
        error: "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email address before logging in. Check your inbox for the verification email.",
      }),
    };
  }

  // Check if this is an email provider user with password
  if (userEntity.provider === "google" || !userEntity.passwordHash) {
    return ResponseUtil.badRequest(
      event,
      "This account uses OAuth authentication. Please sign in with Google."
    );
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    userEntity.passwordHash
  );

  if (!isPasswordValid) {
    return ResponseUtil.unauthorized(event, "Invalid email or password");
  }

  // Check if user is active
  if (!userEntity.isActive) {
    return ResponseUtil.unauthorized(
      event,
      "Account has been disabled. Please contact support."
    );
  }

  // Create user session with auto sign-in
  return SessionUtil.createUserSessionResponse(
    event,
    {
      userId: userEntity.userId,
      userEmail: userEntity.email,
      updateLastLogin: true,
    },
    "Login successful"
  );
};

export const handler = LambdaHandlerUtil.withoutAuth(handleLogin, {
  requireBody: true,
});
