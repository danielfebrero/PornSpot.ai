import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { AuthorizerUtil } from "@shared/utils/authorizer";

/**
 * Admin-Only Authorizer - Only allows admin role
 * This authorizer validates user sessions and checks if the user has admin role only
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("📋 AdminOnlyAuthorizer event:", JSON.stringify(event, null, 2));
  console.log("🎯 AdminOnlyAuthorizer method ARN:", event.methodArn);

  // Allow OPTIONS requests to pass through without authentication (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return AuthorizerUtil.handleOptionsRequest(event);
  }

  try {
    const cookieHeader = AuthorizerUtil.getCookieHeader(event);
    console.log("🍪 Cookie header found:", !!cookieHeader);

    if (!cookieHeader) {
      console.log("❌ No cookie header found");
      throw new Error("No authentication cookie found");
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

      // Check if user has admin role ONLY
      if (userRole === "admin") {
        console.log("🎉 User has admin role. Allowing access.");

        const userContext = {
          userId: userValidation.user.userId,
          email: userValidation.user.email,
          userRole: userRole,
          sessionId: userValidation.session?.sessionId || "",
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
        console.log("❌ User does not have admin role:", userRole);
        throw new Error("Admin access required");
      }
    } else {
      console.log("❌ User session validation failed");
      throw new Error("Invalid session");
    }
  } catch (error) {
    console.error("AdminOnlyAuthorizer: Authorization failed", error);

    // Return explicit deny policy
    return AuthorizerUtil.generatePolicy(
      "unauthorized",
      "Deny",
      event.methodArn
    );
  }
};
