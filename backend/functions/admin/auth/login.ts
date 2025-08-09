import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LoginRequest, AdminSessionEntity } from "@shared";
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

  const adminEntity = await DynamoDBService.getAdminByUsername(username);

  if (!adminEntity) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return ResponseUtil.unauthorized(event, "Invalid username or password");
  }

  if (!adminEntity.isActive) {
    return ResponseUtil.forbidden(event, "Account is disabled");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    adminEntity.passwordHash
  );

  if (!isPasswordValid) {
    return ResponseUtil.unauthorized(event, "Invalid username or password");
  }

  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000
  );

  const sessionEntity: AdminSessionEntity = {
    PK: `SESSION#${sessionId}`,
    SK: "METADATA",
    GSI1PK: "SESSION_EXPIRY",
    GSI1SK: `${expiresAt.toISOString()}#${sessionId}`,
    EntityType: "AdminSession",
    sessionId,
    adminId: adminEntity.adminId,
    adminUsername: adminEntity.username,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastAccessedAt: now.toISOString(),
    ttl: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp for TTL
  };

  await DynamoDBService.createSession(sessionEntity);

  const responseData = {
    admin: {
      adminId: adminEntity.adminId,
      username: adminEntity.username,
      createdAt: adminEntity.createdAt,
      isActive: adminEntity.isActive,
    },
    sessionId,
  };

  const sessionCookie = AuthMiddleware.createSessionCookie(
    sessionId,
    expiresAt.toISOString()
  );

  console.log(`🔑 Admin ${username} logged in successfully`);

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
