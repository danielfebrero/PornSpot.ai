import { v4 as uuidv4 } from "uuid";
import { DynamoDBService } from "./dynamodb";
import { UserEntity } from "@shared/shared-types";
import { UsernameGenerator } from "./username-generator";

export class OAuthUserUtil {
  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    await DynamoDBService.updateUser(userId, {
      lastLoginAt: new Date().toISOString(),
    });
  }

  /**
   * Repair username for OAuth user if needed
   * This checks if the user has a properly formatted username and generates one if not
   */
  static async repairUsernameIfNeeded(user: UserEntity): Promise<string> {
    // Check if user has a username and if it follows the new format
    if (!user.username) {
      console.log(`🔧 Repairing username for OAuth user ${user.userId}`);

      // Generate a new username
      const newUsername = await UsernameGenerator.generateUniqueUsername();

      // Update the user with the new username
      await DynamoDBService.updateUser(user.userId, {
        username: newUsername,
        GSI3PK: "USER_USERNAME",
        GSI3SK: newUsername.toLowerCase(),
      });

      console.log(
        `✅ Repaired username for OAuth user ${user.userId}: ${newUsername}`
      );
      return newUsername;
    }

    return user.username;
  }

  /**
   * Create a new Google user (without password)
   */
  static async createGoogleUser(
    googleId: string,
    email: string,
    isActive: boolean = true
  ): Promise<string> {
    // Check if Google ID already exists
    const existingGoogleUser = await DynamoDBService.getUserByGoogleId(
      googleId
    );
    if (existingGoogleUser) {
      throw new Error("Google account already linked to another user");
    }

    // Generate a unique username using the new username generation system
    const username = await UsernameGenerator.generateUniqueUsername();

    const userId = uuidv4();
    const now = new Date().toISOString();

    const userEntity: UserEntity = {
      PK: `USER#${userId}`,
      SK: "METADATA",
      GSI1PK: "USER_EMAIL",
      GSI1SK: email.toLowerCase(),
      GSI2PK: "USER_GOOGLE",
      GSI2SK: googleId,
      GSI3PK: "USER_USERNAME",
      GSI3SK: username.toLowerCase(),
      EntityType: "User",
      userId,
      email: email.toLowerCase(),
      username,
      provider: "google",
      createdAt: now,
      isActive,
      isEmailVerified: true, // Google accounts are pre-verified
      googleId,
      role: "user",
      plan: "free",
      emailPreferences: {
        pscBalance: "intelligently",
        unreadNotifications: "always",
        newFollowers: "intelligently",
      },
      i2vCreditsSecondsFromPlan: 0,
      i2vCreditsSecondsPurchased: 0,
    };

    await DynamoDBService.createUser(userEntity as UserEntity);

    return userId;
  }

  /**
   * Link Google account to existing user
   */
  static async linkGoogleToUser(
    userId: string,
    googleId: string
  ): Promise<void> {
    const user = await DynamoDBService.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if Google ID already exists
    const existingGoogleUser = await DynamoDBService.getUserByGoogleId(
      googleId
    );
    if (existingGoogleUser && existingGoogleUser.userId !== userId) {
      throw new Error("Google account already linked to another user");
    }

    const updateData: Partial<UserEntity> = {
      googleId,
      GSI2PK: "USER_GOOGLE",
      GSI2SK: googleId,
      isEmailVerified: true, // Mark email as verified when linking Google
    };

    await DynamoDBService.updateUser(userId, updateData);
  }

  /**
   * Create or link Google user account
   */
  static async createOrLinkGoogleUser(
    googleId: string,
    email: string
  ): Promise<{ userId: string; isNewUser: boolean }> {
    // Check if user exists by email
    const existingEmailUser = await DynamoDBService.getUserByEmail(email);

    if (existingEmailUser) {
      // Check if user is active
      if (!existingEmailUser.isActive) {
        throw new Error("Account has been disabled. Please contact support.");
      }

      // Link Google account to existing user
      await this.linkGoogleToUser(existingEmailUser.userId, googleId);

      // Repair username if needed for existing user
      await this.repairUsernameIfNeeded(existingEmailUser);

      return {
        userId: existingEmailUser.userId,
        isNewUser: false,
      };
    } else {
      // Create new Google user
      const userId = await this.createGoogleUser(googleId, email);

      return {
        userId,
        isNewUser: true,
      };
    }
  }

  /**
   * Generate OAuth state parameter for CSRF protection
   */
  static generateOAuthState(): string {
    return uuidv4();
  }

  /**
   * Validate OAuth state parameter
   */
  static validateOAuthState(
    receivedState: string,
    expectedState: string
  ): boolean {
    return receivedState === expectedState && receivedState.length > 0;
  }
}
