import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { UserAuthMiddleware } from "@shared/auth/user-middleware";
import { PlanUtil } from "@shared/utils/plan";

// Helper function to generate an IAM policy
const generatePolicy = (
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
  context?: { [key: string]: any }
): APIGatewayAuthorizerResult => {
  const authResponse: any = {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };

  if (context) {
    authResponse.context = context;
  }

  return authResponse;
};

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
    console.log("OPTIONS request detected, allowing without authentication");
    return generatePolicy("anonymous", "Allow", event.methodArn, {
      requestType: "OPTIONS",
    });
  }

  try {
    const cookieHeader = event.headers?.["Cookie"] || event.headers?.["cookie"];
    console.log("🍪 Cookie header found:", !!cookieHeader);

    if (!cookieHeader) {
      console.log("❌ No cookie header found");
      throw new Error("No authentication cookie found");
    }

    console.log("🔧 Creating mock event for session validation...");
    const mockEvent: any = {
      headers: {
        Cookie: cookieHeader,
      },
    };

    console.log("⚡ Calling UserAuthMiddleware.validateSession...");
    const userValidation = await UserAuthMiddleware.validateSession(mockEvent);
    console.log("📊 User validation result:", {
      isValid: userValidation.isValid,
      hasUser: !!userValidation.user,
      userId: userValidation.user?.userId,
      email: userValidation.user?.email,
    });

    if (userValidation.isValid && userValidation.user) {
      console.log("✅ User session is valid. Checking role...");

      // Get user role
      const userRole = await PlanUtil.getUserRole(
        userValidation.user.userId,
        userValidation.user.email
      );

      console.log("👤 User role:", userRole);

      // Check if user has admin role ONLY
      if (userRole === "admin") {
        console.log("🎉 User has admin role. Allowing access.");

        const userContext = {
          userId: userValidation.user.userId,
          email: userValidation.user.email,
          userRole: userRole,
          sessionId: userValidation.session?.sessionId || "",
        };

        // Reconstruct the ARN to grant access to all admin endpoints
        const { methodArn } = event;
        const parts = methodArn.split(":");
        const region = parts[3];
        const accountId = parts[4];
        const apiGatewayArnPart = parts[5];

        if (!apiGatewayArnPart) {
          console.error("Could not parse method ARN, denying access.");
          return generatePolicy("user", "Deny", event.methodArn);
        }

        const [apiId, stage] = apiGatewayArnPart.split("/");

        // Grant access to all admin endpoints
        const wildcardResource = `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*`;
        console.log("🎯 Granting access to admin resource:", wildcardResource);

        const policy = generatePolicy(
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
    return generatePolicy("unauthorized", "Deny", event.methodArn);
  }
};
