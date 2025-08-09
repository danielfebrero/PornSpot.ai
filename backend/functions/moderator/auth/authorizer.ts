import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { AuthorizerUtil } from "@shared/utils/authorizer";

/**
 * Moderator Authorizer - Allows admin and moderator roles
 * This authorizer validates user sessions and checks if the user has moderator or admin role
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("📋 ModeratorAuthorizer event:", JSON.stringify(event, null, 2));
  console.log("🎯 ModeratorAuthorizer method ARN:", event.methodArn);

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

    const userValidation = await AuthorizerUtil.validateUserSession(cookieHeader);

    if (userValidation.isValid && userValidation.user) {
      console.log("✅ User session is valid. Checking role...");

      // Get user role
      const userRole = await AuthorizerUtil.getUserRole(
        userValidation.user.userId,
        userValidation.user.email
      );

      // Check if user has admin or moderator role
      if (userRole === "admin" || userRole === "moderator") {
        console.log("🎉 User has admin/moderator role. Allowing access.");

        const userContext = {
          userId: userValidation.user.userId,
          email: userValidation.user.email,
          userRole: userRole,
          sessionId: userValidation.session?.sessionId || "",
        };

        return AuthorizerUtil.generatePolicy(
          userValidation.user.userId,
          "Allow",
          event.methodArn,
          userContext
        );
      } else {
        console.log("❌ User does not have admin/moderator role:", userRole);
        throw new Error("Insufficient permissions");
      }
    } else {
      console.log("❌ User session validation failed");
      throw new Error("Invalid session");
    }
  } catch (error) {
    console.error("ModeratorAuthorizer: Authorization failed", error);

    // Return explicit deny policy
    return AuthorizerUtil.generatePolicy("unauthorized", "Deny", event.methodArn);
  }
};
