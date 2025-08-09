import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { SessionValidationResult, AdminUser } from "@shared";

export class AuthMiddleware {
  static async validateSession(
    event: APIGatewayProxyEvent
  ): Promise<SessionValidationResult> {
    try {
      // Extract session ID from cookies
      const cookieHeader =
        event.headers["Cookie"] || event.headers["cookie"] || "";
      console.log("Cookie header received:", cookieHeader);

      const sessionId = this.extractSessionFromCookies(cookieHeader);
      console.log("Extracted session ID:", sessionId);

      if (!sessionId) {
        console.log("No session ID found in cookies");
        return { isValid: false };
      }

      // Get session from database
      const session = await DynamoDBService.getSession(sessionId);

      if (!session) {
        return { isValid: false };
      }

      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      if (now > expiresAt) {
        // Clean up expired session
        await DynamoDBService.deleteSession(sessionId);
        return { isValid: false };
      }

      // Get admin user
      const adminEntity = await DynamoDBService.getAdminById(session.adminId);

      if (!adminEntity || !adminEntity.isActive) {
        return { isValid: false };
      }

      // Update last accessed time
      await DynamoDBService.updateSessionLastAccessed(sessionId);

      const admin: AdminUser = {
        adminId: adminEntity.adminId,
        username: adminEntity.username,
        createdAt: adminEntity.createdAt,
        isActive: adminEntity.isActive,
      };

      return {
        isValid: true,
        admin,
        session: {
          sessionId: session.sessionId,
          adminId: session.adminId,
          adminUsername: session.adminUsername,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
        },
      };
    } catch (error) {
      console.error("Session validation error:", error);
      return { isValid: false };
    }
  }

  static extractSessionFromCookies(cookieHeader: string): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const sessionCookie = cookies.find((cookie) =>
      cookie.startsWith("admin_session=")
    );

    if (!sessionCookie) return null;

    return sessionCookie.split("=")[1] || null;
  }

  static createSessionCookie(sessionId: string, expiresAt: string): string {
    const expires = new Date(expiresAt);
    const isOffline = process.env["IS_OFFLINE"] === "true";

    const cookieParts = [
      `admin_session=${sessionId}`,
      "HttpOnly",
      "Path=/",
      `Expires=${expires.toUTCString()}`,
    ];

    if (isOffline) {
      cookieParts.push("SameSite=Lax");
    } else {
      // If using custom domain (e.g., api.pornspot.ai), we can use SameSite=Lax
      // which is more secure and reliable than SameSite=None
      const useCustomDomain = process.env["USE_CUSTOM_DOMAIN"] === "true";

      if (useCustomDomain) {
        cookieParts.push("Secure", "SameSite=Lax");
      } else {
        // Fallback for AWS API Gateway domain (cross-origin)
        cookieParts.push("Secure", "SameSite=None");
      }
    }

    return cookieParts.join("; ");
  }

  static createClearSessionCookie(): string {
    const isOffline = process.env["IS_OFFLINE"] === "true";

    const cookieParts = [
      "admin_session=",
      "HttpOnly",
      "Path=/",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];

    if (isOffline) {
      cookieParts.push("SameSite=Lax");
    } else {
      // If using custom domain (e.g., api.pornspot.ai), we can use SameSite=Lax
      const useCustomDomain = process.env["USE_CUSTOM_DOMAIN"] === "true";

      if (useCustomDomain) {
        cookieParts.push("Secure", "SameSite=Lax");
      } else {
        // Fallback for AWS API Gateway domain (cross-origin)
        cookieParts.push("Secure", "SameSite=None");
      }
    }

    return cookieParts.join("; ");
  }
}
