import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { UserSessionValidationResult, User } from "@shared/types";
import { UsernameGenerator } from "@shared/utils/username-generator";

export class UserAuthMiddleware {
  static async validateSession(
    event: APIGatewayProxyEvent
  ): Promise<UserSessionValidationResult> {
    try {
      console.log("🔍 Starting session validation...");
      console.log("📋 Event headers:", JSON.stringify(event.headers, null, 2));

      // Extract session ID from cookies
      const cookieHeader =
        event.headers["Cookie"] || event.headers["cookie"] || "";
      console.log("🍪 User cookie header received:", cookieHeader);

      const sessionId = this.extractSessionFromCookies(cookieHeader);
      console.log("🔑 Extracted user session ID:", sessionId);

      // DIAGNOSTIC: Enhanced cookie parsing
      console.log("🔍 DIAGNOSTIC - Raw cookie header:", cookieHeader);
      console.log(
        "🔍 DIAGNOSTIC - All cookies split:",
        cookieHeader.split(";")
      );
      const allCookies = cookieHeader.split(";").map((c) => c.trim());
      allCookies.forEach((cookie, index) => {
        console.log(`🔍 DIAGNOSTIC - Cookie ${index}:`, cookie);
        if (cookie.toLowerCase().includes("session")) {
          console.log(
            `🔍 DIAGNOSTIC - *** Session-related cookie found: ${cookie}`
          );
        }
      });

      if (!sessionId) {
        console.log("❌ No user session ID found in cookies");
        return { isValid: false };
      }

      console.log("🔍 Attempting to get session from database...");
      console.log("🔍 DIAGNOSTIC - Looking up session with ID:", sessionId);
      console.log(
        "🔍 DIAGNOSTIC - Will use DynamoDB key: PK=SESSION#" +
          sessionId +
          ", SK=METADATA"
      );

      // Get session from database
      const session = await DynamoDBService.getUserSession(sessionId);
      console.log("📊 Session from database:", session ? "Found" : "Not found");

      if (session) {
        console.log("🔍 DIAGNOSTIC - Found session details:", {
          PK: session.PK,
          SK: session.SK,
          sessionId: session.sessionId,
          userId: session.userId,
        });
      }

      if (!session) {
        console.log("❌ Session not found in database");
        return { isValid: false };
      }

      console.log("⏰ Session details:", {
        sessionId: session.sessionId,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      });

      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      console.log(
        "⏱️ Time check - Now:",
        now.toISOString(),
        "Expires:",
        expiresAt.toISOString()
      );

      if (now > expiresAt) {
        console.log("⏰ Session is expired, cleaning up...");
        // Clean up expired session
        await DynamoDBService.deleteUserSession(sessionId);
        return { isValid: false };
      }

      console.log("👤 Getting user from database...");
      // Get user
      const userEntity = await DynamoDBService.getUserById(session.userId);
      console.log(
        "👤 User from database:",
        userEntity ? `Found (${userEntity.email})` : "Not found"
      );

      if (!userEntity || !userEntity.isActive) {
        console.log("❌ User not found or inactive:", {
          found: !!userEntity,
          isActive: userEntity?.isActive,
        });
        return { isValid: false };
      }

      // Note: We don't update lastAccessedAt here to keep the authorizer fast
      // Individual endpoints can update it if needed

      // Check if user needs username repair (automatically generate username if missing)
      let currentUsername = userEntity.username;
      if (!currentUsername) {
        console.log(
          "🔧 User missing username, generating one automatically..."
        );
        try {
          currentUsername = await UsernameGenerator.repairMissingUsername(
            userEntity.userId
          );
          console.log(
            `✅ Generated username for user ${userEntity.userId}: ${currentUsername}`
          );
        } catch (error) {
          console.error("❌ Failed to generate username:", error);
          // Don't fail authentication if username generation fails
          // The user can still proceed without a username
        }
      }

      const user: User = {
        userId: userEntity.userId,
        email: userEntity.email,
        createdAt: userEntity.createdAt,
        isActive: userEntity.isActive,
        isEmailVerified: userEntity.isEmailVerified,
        ...(currentUsername && { username: currentUsername }),
        ...(userEntity.firstName && { firstName: userEntity.firstName }),
        ...(userEntity.lastName && { lastName: userEntity.lastName }),
        ...(userEntity.lastLoginAt && { lastLoginAt: userEntity.lastLoginAt }),
        ...(userEntity.lastActive && { lastActive: userEntity.lastActive }),
        ...(userEntity.googleId && { googleId: userEntity.googleId }),
      };

      console.log("🎉 Session validation successful!");
      console.log("👤 Validated user:", {
        userId: user.userId,
        email: user.email,
        username: user.username,
      });

      return {
        isValid: true,
        user,
        session: {
          sessionId: session.sessionId,
          userId: session.userId,
          userEmail: session.userEmail,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
        },
      };
    } catch (error) {
      console.error("💥 User session validation error:", error);
      console.error(
        "💥 Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      return { isValid: false };
    }
  }

  static extractSessionFromCookies(cookieHeader: string): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const sessionCookie = cookies.find((cookie) =>
      cookie.startsWith("user_session=")
    );

    if (!sessionCookie) return null;

    return sessionCookie.split("=")[1] || null;
  }

  static createSessionCookie(sessionId: string, expiresAt: string): string {
    const expires = new Date(expiresAt);
    const isOffline = process.env["IS_OFFLINE"] === "true";

    // Logging for local debug
    console.log(
      "[AUTH] IS_OFFLINE raw:",
      process.env["IS_OFFLINE"],
      "| computed isOffline:",
      isOffline
    );

    const cookieParts = [
      `user_session=${sessionId}`,
      "HttpOnly",
      "Path=/",
      `Expires=${expires.toUTCString()}`,
    ];

    if (isOffline) {
      // Set SameSite=Lax for local development to match admin sessions
      cookieParts.push("SameSite=Lax");
      console.log(
        "[AUTH] (Local) Setting SameSite=Lax for user session cookie"
      );
    } else {
      cookieParts.push("Secure", "SameSite=None");
    }

    const cookieStr = cookieParts.join("; ");
    console.log("[AUTH] Final Set-Cookie:", cookieStr);
    return cookieStr;
  }

  static createClearSessionCookie(): string {
    const isOffline = process.env["IS_OFFLINE"] === "true";

    const cookieParts = [
      "user_session=",
      "HttpOnly",
      "Path=/",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];

    if (isOffline) {
      cookieParts.push("SameSite=Lax");
    } else {
      cookieParts.push("Secure", "SameSite=None");
    }

    return cookieParts.join("; ");
  }
}
