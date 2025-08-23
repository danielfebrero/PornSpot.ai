import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "./dynamodb";
import { UserUtil } from "./user";
import { ResponseUtil } from "./response";
import { UserSessionEntity } from "@shared/shared-types";
import { UserAuthMiddleware } from "../auth/user-middleware";

const SESSION_DURATION_DAYS = 30; // Same duration as regular login

export interface CreateUserSessionOptions {
  userId: string;
  userEmail: string;
  updateLastLogin?: boolean; // Whether to update the user's last login timestamp
}

export interface CreateUserSessionResult {
  sessionId: string;
  sessionCookie: string;
  responseData: {
    user: {
      userId: string;
      email: string;
      username: string;
      createdAt: string;
      isActive: boolean;
      isEmailVerified: boolean;
      lastLoginAt?: string;
      lastActive?: string;
    };
    sessionId: string;
  };
}

/**
 * Utility class for managing user sessions.
 * Centralizes session creation logic to avoid duplication across login, verify-email, and OAuth handlers.
 */
export class SessionUtil {
  /**
   * Creates a new user session and returns session data with cookie.
   * This centralizes the session creation logic used across login, email verification, and OAuth flows.
   *
   * @param options - Session creation options
   * @returns Promise resolving to session data including ID, cookie, and response data
   */
  static async createUserSession(
    options: CreateUserSessionOptions
  ): Promise<CreateUserSessionResult> {
    const { userId, userEmail, updateLastLogin = true } = options;

    // Update last login timestamp if requested
    if (updateLastLogin) {
      await UserUtil.updateLastLogin(userId);
    }

    // Generate session
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    // Create session entity
    const sessionEntity: UserSessionEntity = {
      PK: `SESSION#${sessionId}`,
      SK: "METADATA",
      GSI1PK: "USER_SESSION_EXPIRY",
      GSI1SK: `${expiresAt.toISOString()}#${sessionId}`,
      GSI2PK: `USER#${userId}#SESSION`,
      GSI2SK: `${now.toISOString()}#${sessionId}`,
      EntityType: "UserSession",
      sessionId,
      userId,
      userEmail,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastAccessedAt: now.toISOString(),
      ttl: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp for TTL
    };

    // Save session to database
    await DynamoDBService.createUserSession(sessionEntity);

    // Get updated user data for response
    const userEntity = await DynamoDBService.getUserById(userId);
    if (!userEntity) {
      throw new Error("Failed to retrieve user after session creation");
    }

    // Create session cookie
    const sessionCookie = UserAuthMiddleware.createSessionCookie(
      sessionId,
      expiresAt.toISOString()
    );

    // Prepare response data
    const responseData = {
      user: UserUtil.sanitizeUserForResponse(userEntity),
      sessionId,
    };

    console.log("Session created successfully:", {
      sessionId,
      userId,
      userEmail,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      sessionId,
      sessionCookie,
      responseData,
    };
  }

  /**
   * Creates a user session and returns a complete API Gateway response with the session cookie set.
   * This is a convenience method for handlers that need to return a complete response.
   *
   * @param event - API Gateway event (for CORS and response formatting)
   * @param options - Session creation options
   * @param message - Success message for the response
   * @returns Promise resolving to complete API Gateway response
   */
  static async createUserSessionResponse(
    event: APIGatewayProxyEvent,
    options: CreateUserSessionOptions,
    message: string = "Authentication successful"
  ): Promise<APIGatewayProxyResult> {
    try {
      const sessionResult = await this.createUserSession(options);

      const response = ResponseUtil.success(event, {
        message,
        ...sessionResult.responseData,
      });

      response.headers = {
        ...response.headers,
        "Set-Cookie": sessionResult.sessionCookie,
      };

      return response;
    } catch (error) {
      console.error("Session creation error:", error);
      throw error; // Let the calling handler decide how to handle the error
    }
  }
}
