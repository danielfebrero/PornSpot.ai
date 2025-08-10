import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LoginRequest, UserSessionEntity } from "@shared";
import { AuthMiddleware } from "@shared/auth/admin-middleware";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const SESSION_DURATION_HOURS = 24;

const handleAdminLogin = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const request: LoginRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Validate input using shared validation
  const username = ValidationUtil.validateRequiredString(request.username, "Username");
  const password = ValidationUtil.validateRequiredString(request.password, "Password");

  // Look for user by username (admins are now users with role="admin")
  const userEntity = await DynamoDBService.getUserByUsername(username);

  if (!userEntity) {
    // Also try by email as fallback
    const userByEmail = await DynamoDBService.getUserByEmail(username);
    if (!userByEmail) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return ResponseUtil.unauthorized(event, "Invalid username or password");
    }
  }

  const user = userEntity || await DynamoDBService.getUserByEmail(username);

  if (!user) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return ResponseUtil.unauthorized(event, "Invalid username or password");
  }

  if (!user.isActive) {
    return ResponseUtil.forbidden(event, "Account is disabled");
  }

  // Check if user has admin role
  if (user.role !== "admin") {
    return ResponseUtil.forbidden(event, "Admin access required");
  }

  // Check password (users should have passwordHash for admin login)
  if (!user.passwordHash) {
    return ResponseUtil.unauthorized(event, "Invalid login method");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return ResponseUtil.unauthorized(event, "Invalid username or password");
  }

  // Create user session instead of admin session
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000
  );

  const sessionEntity: UserSessionEntity = {
    PK: `SESSION#${sessionId}`,
    SK: "METADATA",
    GSI1PK: "USER_SESSION_EXPIRY",
    GSI1SK: `${expiresAt.toISOString()}#${sessionId}`,
    EntityType: "UserSession",
    sessionId,
    userId: user.userId,
    userEmail: user.email,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastAccessedAt: now.toISOString(),
    ttl: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp for TTL
  };

  await DynamoDBService.createUserSession(sessionEntity);

  const responseData = {
    admin: {
      adminId: user.userId,
      username: user.username || user.email,
      createdAt: user.createdAt,
      isActive: user.isActive,
    },
    sessionId,
  };

  // Use user session cookie instead of admin session cookie
  const sessionCookie = AuthMiddleware.createSessionCookie(
    sessionId,
    expiresAt.toISOString()
  );

  console.log(`🔑 Admin ${username} logged in successfully (role: ${user.role})`);

  const successResponse = ResponseUtil.success(event, responseData);
  successResponse.headers = {
    ...successResponse.headers,
    "Set-Cookie": sessionCookie,
  };

  return successResponse;
};

export const handler = LambdaHandlerUtil.withoutAuth(handleAdminLogin, {
  requireBody: true,
});
