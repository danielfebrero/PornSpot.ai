import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UserAuthMiddleware } from "@shared/auth/user-middleware";
import { ResponseUtil } from "@shared/utils/response";
import { PlanUtil } from "@shared/utils/plan";

export interface UserAuthOptions {
  /**
   * Whether to allow anonymous access when no user is authenticated.
   * If false (default), unauthorized responses are returned for missing auth.
   * If true, null userId is returned without error.
   */
  allowAnonymous?: boolean;

  /**
   * Whether to include role information in the returned user context.
   * When true, the user's role (admin, moderator, user) is fetched and included.
   */
  includeRole?: boolean;
}

export interface UserAuthResult {
  /**
   * The authenticated user's ID, or null if no user is authenticated
   * and allowAnonymous is true.
   */
  userId: string | null;

  /**
   * The user's role (admin, moderator, user) if includeRole was requested.
   */
  userRole?: string;

  /**
   * The user's email address if available from session validation.
   */
  userEmail?: string;

  /**
   * Whether the user was authenticated via authorizer context or session fallback.
   */
  authSource: "authorizer" | "session" | "anonymous";
}

/**
 * Centralized utility for extracting and validating user authentication.
 *
 * This utility implements the standard authentication pattern used across
 * the application:
 * 1. First check for userId in request context (set by authorizers)
 * 2. Fall back to session validation for local development
 * 3. Handle anonymous access based on configuration
 *
 * @param event - The API Gateway proxy event
 * @param options - Configuration options for authentication behavior
 * @returns Promise resolving to UserAuthResult or APIGatewayProxyResult for errors
 */
export class UserAuthUtil {
  static async extractUserAuth(
    event: APIGatewayProxyEvent,
    options: UserAuthOptions = {}
  ): Promise<UserAuthResult | APIGatewayProxyResult> {
    const { allowAnonymous = false, includeRole = false } = options;

    try {
      // Step 1: Try to get user ID from request context (set by authorizers)
      let userId = event.requestContext.authorizer?.["userId"] as string;
      let userRole = event.requestContext.authorizer?.["role"] as string;
      let userEmail: string | undefined;
      let authSource: "authorizer" | "session" | "anonymous" = "authorizer";

      console.log("👤 UserId from authorizer:", userId);
      if (userRole) {
        console.log("🎭 UserRole from authorizer:", userRole);
      }

      // Step 2: Fallback for local development or when authorizer context is missing
      if (!userId) {
        console.log(
          "⚠️ No userId from authorizer, falling back to session validation"
        );

        const validation = await UserAuthMiddleware.validateSession(event);

        if (!validation.isValid || !validation.user) {
          // Check if anonymous access is allowed
          if (allowAnonymous) {
            console.log(
              "ℹ️ Session validation failed, but anonymous access allowed"
            );
            return {
              userId: null,
              authSource: "anonymous",
              ...(includeRole && { userRole: "anonymous" }),
            };
          }

          console.log("❌ Session validation failed");
          return ResponseUtil.unauthorized(event, "No user session found");
        }

        userId = validation.user.userId;
        userEmail = validation.user.email;
        authSource = "session";

        console.log("✅ Got userId from session validation:", userId);

        // Get user role if requested and not already available
        if (includeRole && !userRole) {
          userRole = await PlanUtil.getUserRole(userId);
          console.log("✅ User role from PlanUtil:", userRole);
        }
      } else if (includeRole && !userRole) {
        // If userId came from authorizer but no role, and role is requested
        // We need to fetch the user's email first to get the role
        const validation = await UserAuthMiddleware.validateSession(event);
        if (validation.isValid && validation.user) {
          userEmail = validation.user.email;
          userRole = await PlanUtil.getUserRole(userId);
          console.log(
            "✅ User role from PlanUtil (authorizer fallback):",
            userRole
          );
        }
      }

      // Step 3: Build and return the auth result
      const result: UserAuthResult = {
        userId,
        authSource,
        ...(userEmail && { userEmail }),
        ...(includeRole && userRole && { userRole }),
      };

      console.log("🎉 User authentication successful:", {
        userId: result.userId,
        authSource: result.authSource,
        ...(result.userRole && { userRole: result.userRole }),
      });

      return result;
    } catch (error) {
      console.error("❌ Error in user authentication extraction:", error);

      if (allowAnonymous) {
        console.log("⚠️ Authentication error, but anonymous access allowed");
        return {
          userId: null,
          authSource: "anonymous",
          ...(includeRole && { userRole: "anonymous" }),
        };
      }

      return ResponseUtil.internalError(event, "Authentication error");
    }
  }

  /**
   * Convenience method for cases where authentication is required.
   * Returns only the user ID or throws an error response.
   */
  static async requireAuth(
    event: APIGatewayProxyEvent,
    options: Omit<UserAuthOptions, "allowAnonymous"> = {}
  ): Promise<UserAuthResult | APIGatewayProxyResult> {
    return this.extractUserAuth(event, { ...options, allowAnonymous: false });
  }

  /**
   * Convenience method for cases where anonymous access is allowed.
   * Returns the user ID (which may be null) without throwing errors.
   */
  static async allowAnonymous(
    event: APIGatewayProxyEvent,
    options: Omit<UserAuthOptions, "allowAnonymous"> = {}
  ): Promise<UserAuthResult | APIGatewayProxyResult> {
    return this.extractUserAuth(event, { ...options, allowAnonymous: true });
  }

  /**
   * Type guard to check if the result is an error response.
   */
  static isErrorResponse(
    result: UserAuthResult | APIGatewayProxyResult
  ): result is APIGatewayProxyResult {
    return "statusCode" in result;
  }
}
