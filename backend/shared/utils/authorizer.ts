import {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { UserAuthMiddleware } from "../auth/user-middleware";
import { PlanUtil } from "./plan";

/**
 * Shared utility for Lambda authorizers to eliminate code duplication
 */
export class AuthorizerUtil {
  /**
   * Generate an IAM policy for API Gateway authorizer response
   */
  static generatePolicy(
    principalId: string,
    effect: "Allow" | "Deny",
    resource: string,
    context?: { [key: string]: string | number | boolean }
  ): APIGatewayAuthorizerResult {
    const authResponse: APIGatewayAuthorizerResult = {
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
  }

  /**
   * Handle OPTIONS requests for CORS preflight
   */
  static handleOptionsRequest(
    event: APIGatewayRequestAuthorizerEvent
  ): APIGatewayAuthorizerResult {
    console.log("OPTIONS request detected, allowing without authentication");
    
    try {
      const { methodArn } = event;
      const parts = methodArn.split(":");
      const region = parts[3];
      const accountId = parts[4];
      const apiGatewayArnPart = parts[5];

      if (apiGatewayArnPart && region && accountId) {
        const [apiId, stage] = apiGatewayArnPart.split("/");
        if (apiId && stage) {
          const wildcardResource = `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*`;

          return this.generatePolicy("anonymous", "Allow", wildcardResource, {
            requestType: "OPTIONS",
          });
        }
      }

      // Fallback: allow the specific resource if ARN parsing fails
      console.log("ARN parsing failed for OPTIONS, allowing specific resource");
      return this.generatePolicy("anonymous", "Allow", event.methodArn, {
        requestType: "OPTIONS",
      });
    } catch (error) {
      console.error("Error handling OPTIONS request:", error);
      // Even if there's an error, allow OPTIONS to pass through
      return this.generatePolicy("anonymous", "Allow", event.methodArn, {
        requestType: "OPTIONS",
      });
    }
  }

  /**
   * Get cookie header from event (handles case-insensitive header names)
   */
  static getCookieHeader(event: APIGatewayRequestAuthorizerEvent): string | undefined {
    return event.headers?.["Cookie"] || event.headers?.["cookie"];
  }

  /**
   * Validate user session and return user validation result
   */
  static async validateUserSession(cookieHeader: string) {
    console.log("🔧 Creating mock event for session validation...");
    const mockEvent: { headers: { Cookie: string } } = {
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

    return userValidation;
  }

  /**
   * Get user role for authorization checks
   */
  static async getUserRole(userId: string, email: string): Promise<string> {
    const userRole = await PlanUtil.getUserRole(userId, email);
    console.log("👤 User role:", userRole);
    return userRole;
  }

  /**
   * Generate wildcard resource ARN for the API
   */
  static generateWildcardResource(methodArn: string): string | null {
    const parts = methodArn.split(":");
    const region = parts[3];
    const accountId = parts[4];
    const apiGatewayArnPart = parts[5];

    if (!apiGatewayArnPart) {
      return null;
    }

    const [apiId, stage] = apiGatewayArnPart.split("/");
    return `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*`;
  }
}