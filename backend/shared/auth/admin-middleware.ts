import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { SessionValidationResult, AdminUser } from "@shared";
import { UserAuthMiddleware } from "./user-middleware";

export class AuthMiddleware {
  static async validateSession(
    event: APIGatewayProxyEvent
  ): Promise<SessionValidationResult> {
    try {
      console.log("🔐 Admin middleware: Starting session validation");

      // Use user authentication middleware to validate the session
      const userValidation = await UserAuthMiddleware.validateSession(event);
      
      if (!userValidation.isValid || !userValidation.user) {
        console.log("❌ Admin middleware: User session validation failed");
        return { isValid: false };
      }

      console.log("✅ Admin middleware: User session valid, checking admin role");

      // Get the user entity to check the role
      const userEntity = await DynamoDBService.getUserById(userValidation.user.userId);
      
      if (!userEntity || !userEntity.isActive) {
        console.log("❌ Admin middleware: User not found or inactive");
        return { isValid: false };
      }

      // Check if user has admin role
      if (userEntity.role !== "admin") {
        console.log(`❌ Admin middleware: User role '${userEntity.role}' is not admin`);
        return { isValid: false };
      }

      console.log("✅ Admin middleware: User has admin role, validation successful");

      // Create admin user object compatible with existing code
      const admin: AdminUser = {
        adminId: userEntity.userId, // Use userId as adminId for compatibility
        username: userEntity.username || userEntity.email, // Use username or email as fallback
        createdAt: userEntity.createdAt,
        isActive: userEntity.isActive,
      };

      return {
        isValid: true,
        admin,
        session: {
          sessionId: userValidation.session!.sessionId,
          adminId: userEntity.userId, // Use userId as adminId for compatibility
          adminUsername: userEntity.username || userEntity.email,
          createdAt: userValidation.session!.createdAt,
          expiresAt: userValidation.session!.expiresAt,
          lastAccessedAt: userValidation.session!.lastAccessedAt,
        },
      };
    } catch (error) {
      console.error("❌ Admin middleware session validation error:", error);
      return { isValid: false };
    }
  }

  // Legacy cookie methods for backwards compatibility with admin login/logout
  // Since admins are now users, we delegate to user middleware but maintain
  // admin_session cookie name for backwards compatibility
  static extractSessionFromCookies(cookieHeader: string): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    
    // Try admin_session first for backwards compatibility
    const adminSessionCookie = cookies.find((cookie) =>
      cookie.startsWith("admin_session=")
    );
    
    if (adminSessionCookie) {
      return adminSessionCookie.split("=")[1] || null;
    }

    // Fall back to user_session
    return UserAuthMiddleware.extractSessionFromCookies(cookieHeader);
  }

  static createSessionCookie(sessionId: string, expiresAt: string): string {
    // For admin login, still create admin_session cookie for backwards compatibility
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
      const useCustomDomain = process.env["USE_CUSTOM_DOMAIN"] === "true";

      if (useCustomDomain) {
        cookieParts.push("Secure", "SameSite=Lax");
      } else {
        cookieParts.push("Secure", "SameSite=None");
      }
    }

    return cookieParts.join("; ");
  }

  static createClearSessionCookie(): string {
    // Clear admin_session cookie for backwards compatibility
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
      const useCustomDomain = process.env["USE_CUSTOM_DOMAIN"] === "true";

      if (useCustomDomain) {
        cookieParts.push("Secure", "SameSite=Lax");
      } else {
        cookieParts.push("Secure", "SameSite=None");
      }
    }

    return cookieParts.join("; ");
  }
}
