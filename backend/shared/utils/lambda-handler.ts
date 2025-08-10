import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "./response";
import { UserAuthUtil } from "./user-auth";
import { DynamoDBService } from "./dynamodb";

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
  /**
   * Require a request body. When an array is provided, the body is required only for the listed HTTP methods.
   */
  requireBody?: boolean | string[];
  validatePathParams?: string[];
  /**
   * Validate that specific query string parameters are present and non-empty
   */
  validateQueryParams?: string[];
  /**
   * If provided, validatePathParams will only be enforced for the specified HTTP methods
   */
  validatePathParamsMethods?: string[];
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

        // Validate required path parameters (optionally by method)
        if (
          config.validatePathParams &&
          (!config.validatePathParamsMethods ||
            config.validatePathParamsMethods.includes(event.httpMethod))
        ) {
          for (const param of config.validatePathParams) {
            if (!event.pathParameters?.[param]) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in path`
              );
            }
          }
        }

        // Validate request body if required (supports method-scoped array)
        const requireBody = Array.isArray(config.requireBody)
          ? config.requireBody.includes(event.httpMethod)
          : !!config.requireBody;
        if (requireBody && !event.body) {
          return ResponseUtil.badRequest(event, "Request body is required");
        }

        // Validate required query string parameters
        if (config.validateQueryParams) {
          for (const param of config.validateQueryParams) {
            const value = event.queryStringParameters?.[param];
            if (
              value === undefined ||
              value === null ||
              String(value).trim() === ""
            ) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in query`
              );
            }
          }
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

        // Validate required path parameters (optionally by method)
        if (
          config.validatePathParams &&
          (!config.validatePathParamsMethods ||
            config.validatePathParamsMethods.includes(event.httpMethod))
        ) {
          for (const param of config.validatePathParams) {
            if (!event.pathParameters?.[param]) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in path`
              );
            }
          }
        }

        // Validate request body if required (supports method-scoped array)
        const requireBody = Array.isArray(config.requireBody)
          ? config.requireBody.includes(event.httpMethod)
          : !!config.requireBody;
        if (requireBody && !event.body) {
          return ResponseUtil.badRequest(event, "Request body is required");
        }

        // Validate required query string parameters
        if (config.validateQueryParams) {
          for (const param of config.validateQueryParams) {
            const value = event.queryStringParameters?.[param];
            if (
              value === undefined ||
              value === null ||
              String(value).trim() === ""
            ) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in query`
              );
            }
          }
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

        // Validate required path parameters (optionally by method)
        if (
          config.validatePathParams &&
          (!config.validatePathParamsMethods ||
            config.validatePathParamsMethods.includes(event.httpMethod))
        ) {
          for (const param of config.validatePathParams) {
            if (!event.pathParameters?.[param]) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in path`
              );
            }
          }
        }

        // Validate request body if required (supports method-scoped array)
        const requireBody = Array.isArray(config.requireBody)
          ? config.requireBody.includes(event.httpMethod)
          : !!config.requireBody;
        if (requireBody && !event.body) {
          return ResponseUtil.badRequest(event, "Request body is required");
        }

        // Validate required query string parameters
        if (config.validateQueryParams) {
          for (const param of config.validateQueryParams) {
            const value = event.queryStringParameters?.[param];
            if (
              value === undefined ||
              value === null ||
              String(value).trim() === ""
            ) {
              return ResponseUtil.badRequest(
                event,
                `${param} is required in query`
              );
            }
          }
        }

        // Use user authentication with role checking for admin access
        const authResult = await UserAuthUtil.requireAuth(event, {
          includeRole: true,
        });

        if (UserAuthUtil.isErrorResponse(authResult)) {
          return authResult;
        }

        // Check if user has admin role
        if (authResult.userRole !== "admin") {
          console.log(`❌ Access denied: User role '${authResult.userRole}' is not admin`);
          return ResponseUtil.forbidden(
            event,
            "Admin access required"
          );
        }

        // Get user details for admin context
        const userEntity = await DynamoDBService.getUserById(authResult.userId!);
        if (!userEntity) {
          console.log("❌ Admin user not found in database");
          return ResponseUtil.unauthorized(event, "Admin user not found");
        }

        const auth: AdminAuthResult = {
          adminId: userEntity.userId, // Use userId as adminId for compatibility
          username: userEntity.username || userEntity.email, // Use username or email as fallback
        };

        console.log("✅ Authenticated admin via user role:", auth.username);

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
