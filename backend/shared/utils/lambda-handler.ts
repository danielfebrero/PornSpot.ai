import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "./response";
import { UserAuthUtil } from "./user-auth";
import { AuthMiddleware } from "../auth/admin-middleware";

export interface AuthResult {
  userId: string;
  userRole?: string;
}

export interface AdminAuthResult {
  adminId: string;
  username: string;
}

export interface LambdaHandlerConfig {
  requireAuth?: boolean;
  includeRole?: boolean;
  requireBody?: boolean;
  validatePathParams?: string[];
}

export type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  auth: AuthResult
) => Promise<APIGatewayProxyResult>;

export type AdminAuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
) => Promise<APIGatewayProxyResult>;

export type UnauthenticatedHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Shared Lambda handler wrapper that handles common patterns:
 * - OPTIONS request handling
 * - Authentication validation
 * - Request body validation
 * - Path parameter validation
 * - Centralized error handling
 */
export class LambdaHandlerUtil {
  /**
   * Wrap a handler that requires authentication
   */
  static withAuth(
    handler: AuthenticatedHandler,
    config: LambdaHandlerConfig = {}
  ) {
    return async (
      event: APIGatewayProxyEvent
    ): Promise<APIGatewayProxyResult> => {
      try {
        // Handle OPTIONS requests
        if (event.httpMethod === "OPTIONS") {
          return ResponseUtil.noContent(event);
        }

        // Validate required path parameters
        if (config.validatePathParams) {
          for (const param of config.validatePathParams) {
            if (!event.pathParameters?.[param]) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in path`
              );
            }
          }
        }

        // Validate request body if required
        if (config.requireBody && !event.body) {
          return ResponseUtil.badRequest(event, "Request body is required");
        }

        // Handle authentication
        const authResult = await UserAuthUtil.requireAuth(event, {
          includeRole: config.includeRole || false,
        });

        if (UserAuthUtil.isErrorResponse(authResult)) {
          return authResult;
        }

        const auth: AuthResult = {
          userId: authResult.userId!,
          ...(authResult.userRole && { userRole: authResult.userRole }),
        };

        console.log("✅ Authenticated user:", auth.userId);
        if (auth.userRole) {
          console.log("🎭 User role:", auth.userRole);
        }

        // Call the actual handler
        return await handler(event, auth);
      } catch (error) {
        console.error("❌ Lambda handler error:", error);
        return ResponseUtil.internalError(
          event,
          error instanceof Error ? error.message : "Internal server error"
        );
      }
    };
  }

  /**
   * Wrap a handler that doesn't require authentication
   */
  static withoutAuth(
    handler: UnauthenticatedHandler,
    config: LambdaHandlerConfig = {}
  ) {
    return async (
      event: APIGatewayProxyEvent
    ): Promise<APIGatewayProxyResult> => {
      try {
        // Handle OPTIONS requests
        if (event.httpMethod === "OPTIONS") {
          return ResponseUtil.noContent(event);
        }

        // Validate required path parameters
        if (config.validatePathParams) {
          for (const param of config.validatePathParams) {
            if (!event.pathParameters?.[param]) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in path`
              );
            }
          }
        }

        // Validate request body if required
        if (config.requireBody && !event.body) {
          return ResponseUtil.badRequest(event, "Request body is required");
        }

        // Call the actual handler
        return await handler(event);
      } catch (error) {
        console.error("❌ Lambda handler error:", error);
        return ResponseUtil.internalError(
          event,
          error instanceof Error ? error.message : "Internal server error"
        );
      }
    };
  }

  /**
   * Helper to parse JSON body with error handling
   */
  static parseJsonBody<T>(event: APIGatewayProxyEvent): T {
    if (!event.body) {
      throw new Error("Request body is required");
    }

    try {
      return JSON.parse(event.body) as T;
    } catch (error) {
      throw new Error("Invalid JSON in request body");
    }
  }

  /**
   * Helper to extract path parameter with validation
   */
  static getPathParam(event: APIGatewayProxyEvent, paramName: string): string {
    const value = event.pathParameters?.[paramName];
    if (!value) {
      throw new Error(`${paramName} is required in path`);
    }
    return value;
  }

  /**
   * Helper to check ownership or admin privileges
   */
  static checkOwnershipOrAdmin(
    resourceCreatedBy: string,
    userId: string,
    userRole?: string
  ): boolean {
    const isOwner = resourceCreatedBy === userId;
    const isAdmin = userRole === "admin" || userRole === "moderator";
    return isOwner || isAdmin;
  }

  /**
   * Wrap a handler that requires admin authentication
   */
  static withAdminAuth(
    handler: AdminAuthenticatedHandler,
    config: LambdaHandlerConfig = {}
  ) {
    return async (
      event: APIGatewayProxyEvent
    ): Promise<APIGatewayProxyResult> => {
      try {
        // Handle OPTIONS requests
        if (event.httpMethod === "OPTIONS") {
          return ResponseUtil.noContent(event);
        }

        // Validate required path parameters
        if (config.validatePathParams) {
          for (const param of config.validatePathParams) {
            if (!event.pathParameters?.[param]) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in path`
              );
            }
          }
        }

        // Validate request body if required
        if (config.requireBody && !event.body) {
          return ResponseUtil.badRequest(event, "Request body is required");
        }

        // Prefer API Gateway authorizer context (prod) and fallback to session (local dev)
        const authorizer = event.requestContext.authorizer || {};
        const userId = (authorizer["userId"] as string) || undefined;
        // Support both 'role' and 'userRole' keys depending on authorizer implementation
        const userRole =
          (authorizer["role"] as string) ||
          (authorizer["userRole"] as string) ||
          undefined;
        const email = (authorizer["email"] as string) || undefined;

        if (userId) {
          console.log("🔐 Authorizer context found for admin:", {
            userId,
            ...(userRole && { userRole }),
          });

          // Note: Authorizer already enforced access; we just pass identity to handler
          const auth: AdminAuthResult = {
            adminId: userId,
            // Use email if present; otherwise a stable identifier
            username: email || userId,
          };

          console.log("✅ Authenticated admin via authorizer:", auth.username);
          return await handler(event, auth);
        }

        // Fallback: local dev without authorizers → validate admin session cookie
        console.log(
          "🔁 No authorizer context. Falling back to session validation..."
        );
        const sessionResult = await AuthMiddleware.validateSession(event);

        if (!sessionResult.isValid || !sessionResult.admin) {
          console.log(
            "❌ Admin authentication failed (no authorizer and invalid session)"
          );
          return ResponseUtil.unauthorized(
            event,
            "Admin authentication required"
          );
        }

        const auth: AdminAuthResult = {
          adminId: sessionResult.admin.adminId,
          username: sessionResult.admin.username,
        };

        console.log("✅ Authenticated admin via session:", auth.username);

        // Call the actual handler
        return await handler(event, auth);
      } catch (error) {
        console.error("❌ Lambda handler error:", error);
        return ResponseUtil.internalError(
          event,
          error instanceof Error ? error.message : "Internal server error"
        );
      }
    };
  }
}
