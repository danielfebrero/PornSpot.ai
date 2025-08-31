import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { AuthorizerUtil } from "@shared/utils/authorizer";
import { DynamoDBService } from "@shared/utils/dynamodb";

/**
 * User Authorizer - Allows authenticated users to access user and public endpoints
 * This authorizer validates user sessions and grants access to non-admin endpoints
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log("🔒 User Authorizer called");
  console.log("📋 Authorizer event:", JSON.stringify(event, null, 2));
  console.log("🎯 Authorizer method ARN:", event.methodArn);
  console.log("🍪 Headers:", JSON.stringify(event.headers, null, 2));

  // Allow OPTIONS requests to pass through without authentication (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return AuthorizerUtil.handleOptionsRequest(event);
  }

  try {
    console.log("🔍 Processing non-OPTIONS request...");
    const cookieHeader = AuthorizerUtil.getCookieHeader(event);
    console.log("🍪 Cookie header found:", !!cookieHeader);
    console.log("🍪 Cookie header value:", cookieHeader);

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
      console.log("✅ User session is valid. Allowing access.");
      console.log("👤 User details:", {
        userId: userValidation.user.userId,
        email: userValidation.user.email,
      });

      // Update lastActive timestamp to track user activity
      // This happens in the authorizer to avoid giving write permissions to all functions
      try {
        const currentTime = new Date().toISOString();
        await DynamoDBService.updateUser(userValidation.user.userId, {
          lastActive: currentTime,
        });
        console.log("📅 Updated user lastActive timestamp");
      } catch (updateError) {
        console.error("⚠️ Failed to update lastActive timestamp:", updateError);
        // Don't fail authorization if lastActive update fails
      }

      const userContext = {
        userId: userValidation.user.userId,
        email: userValidation.user.email,
        role: userValidation.user.role,
      };
      console.log("🎯 Setting user context:", userContext);

      // Grant access to user and public endpoints (exclude admin-only endpoints)
      const wildcardResource = AuthorizerUtil.generateWildcardResource(
        event.methodArn
      );

      if (!wildcardResource) {
        console.error("Could not parse method ARN, denying access.");
        return AuthorizerUtil.generatePolicy("user", "Deny", event.methodArn);
      }

      console.log("🎯 Granting access to resource:", wildcardResource);

      const policy = AuthorizerUtil.generatePolicy(
        userValidation.user.userId,
        "Allow",
        wildcardResource,
        userContext
      );
      console.log("📋 Generated policy:", JSON.stringify(policy, null, 2));
      return policy;
    }

    console.log("❌ No valid session found. Denying access.");
    return AuthorizerUtil.generatePolicy("anonymous", "Deny", event.methodArn);
  } catch (error) {
    console.error("💥 Authorizer error:", error);
    console.error(
      "💥 Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return AuthorizerUtil.generatePolicy("user", "Deny", event.methodArn);
  }
};
