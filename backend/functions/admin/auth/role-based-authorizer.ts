/**
 * @fileoverview Role-Based Admin Request Authorizer
 * @description AWS Lambda authorizer for API Gateway that enforces admin or moderator roles using wildcard policies, validating sessions via cookies.
 * @event APIGatewayRequestAuthorizerEvent
 * @returns APIGatewayAuthorizerResult - Allow with wildcard resource and user context if authorized, Deny otherwise.
 * @notes
 * - Bypasses auth for OPTIONS preflight (CORS).
 * - Validates user session from cookie.
 * - Queries role from DynamoDB.
 * - Generates wildcard resource for all admin endpoints.
 * - Includes user context (userId, email, role) in Allow policy.
 * - Explicit Deny for non-authorized roles or invalid sessions.
 * - Comprehensive error logging with stack traces.
 */
import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { AuthorizerUtil } from "@shared/utils/authorizer";

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("🔒 Role-Based Admin Authorizer called");
  console.log("📋 Authorizer event:", JSON.stringify(event, null, 2));
  console.log("🎯 Authorizer method ARN:", event.methodArn);

  // Allow OPTIONS requests to pass through without authentication (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return AuthorizerUtil.handleOptionsRequest(event);
  }

  try {
    const cookieHeader = AuthorizerUtil.getCookieHeader(event);
    console.log("🍪 Cookie header found:", !!cookieHeader);

    if (!cookieHeader) {
      console.log("❌ No cookie header found, denying access.");
      return AuthorizerUtil.generatePolicy(
        "anonymous",
        "Deny",
        event.methodArn
      );
    }

    const userValidation = await AuthorizerUtil.validateUserSession(
      cookieHeader
    );

    if (userValidation.isValid && userValidation.user) {
      console.log("✅ User session is valid. Checking role...");

      // Get user role
      const userRole = await AuthorizerUtil.getUserRole(
        userValidation.user.userId
      );

      // Check if user has admin or moderator role
      if (userRole === "admin" || userRole === "moderator") {
        console.log("🎉 User has admin/moderator role. Allowing access.");

        const userContext = {
          userId: userValidation.user.userId,
          email: userValidation.user.email,
          role: userRole,
        };

        // Grant access to all admin endpoints
        const wildcardResource = AuthorizerUtil.generateWildcardResource(
          event.methodArn
        );

        if (!wildcardResource) {
          console.error("Could not parse method ARN, denying access.");
          return AuthorizerUtil.generatePolicy("user", "Deny", event.methodArn);
        }

        console.log("🎯 Granting access to admin resource:", wildcardResource);

        const policy = AuthorizerUtil.generatePolicy(
          userValidation.user.userId,
          "Allow",
          wildcardResource,
          userContext
        );
        console.log("📋 Generated policy:", JSON.stringify(policy, null, 2));
        return policy;
      } else {
        console.log("❌ User does not have admin role. Denying access.");
        return AuthorizerUtil.generatePolicy(
          userValidation.user.userId,
          "Deny",
          event.methodArn
        );
      }
    }

    console.log("❌ No valid user session found. Denying access.");
    return AuthorizerUtil.generatePolicy("anonymous", "Deny", event.methodArn);
  } catch (error) {
    console.error("💥 Role-based authorizer error:", error);
    console.error(
      "💥 Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return AuthorizerUtil.generatePolicy("user", "Deny", event.methodArn);
  }
};
