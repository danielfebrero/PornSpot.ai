import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";
import { DynamoDBService } from "./dynamodb";
import { UserEntity, EmailVerificationTokenEntity } from "../types/user";

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

export class UserUtil {
  /**
   * Create a new user with hashed password
   */
  static async createUser(
    email: string,
    password: string,
    username: string,
    isActive: boolean = true
  ): Promise<string> {
    // Check if email already exists
    const existingUser = await DynamoDBService.getUserByEmail(email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Check if username already exists
    const existingUsername = await DynamoDBService.getUserByUsername(username);
    if (existingUsername) {
      throw new Error("Username already exists");
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();
    const now = new Date().toISOString();

    const userEntity: UserEntity = {
      PK: `USER#${userId}`,
      SK: "METADATA",
      GSI1PK: "USER_EMAIL",
      GSI1SK: email.toLowerCase(),
      GSI3PK: "USER_USERNAME",
      GSI3SK: username.toLowerCase(),
      EntityType: "User",
      userId,
      email: email.toLowerCase(),
      username: username.trim(),
      passwordHash,
      salt,
      provider: "email",
      createdAt: now,
      isActive,
      isEmailVerified: false, // Email verification will be Phase 2
    };

    await DynamoDBService.createUser(userEntity);

    return userId;
  }

  /**
   * Update user password
   */
  static async updateUserPassword(
    userId: string,
    newPassword: string
  ): Promise<void> {
    const user = await DynamoDBService.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate new salt and hash
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await DynamoDBService.updateUser(userId, {
      passwordHash,
      salt,
    });
  }

  /**
   * Deactivate a user
   */
  static async deactivateUser(userId: string): Promise<void> {
    const user = await DynamoDBService.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await DynamoDBService.updateUser(userId, {
      isActive: false,
    });
  }

  /**
   * Activate a user
   */
  static async activateUser(userId: string): Promise<void> {
    const user = await DynamoDBService.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await DynamoDBService.updateUser(userId, {
      isActive: true,
    });
  }

  /**
   * Mark user email as verified
   */
  static async markEmailVerified(userId: string): Promise<void> {
    const user = await DynamoDBService.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await DynamoDBService.updateUser(userId, {
      isEmailVerified: true,
    });
  }

  /**
   * Update user last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    await DynamoDBService.updateUser(userId, {
      lastLoginAt: new Date().toISOString(),
    });
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate username format and requirements
   */
  static validateUsername(username: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!username || username.trim().length === 0) {
      errors.push("Username is required");
      return { isValid: false, errors };
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3) {
      errors.push("Username must be at least 3 characters long");
    }

    if (trimmedUsername.length > 30) {
      errors.push("Username must be at most 30 characters long");
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      errors.push(
        "Username can only contain letters, numbers, underscores, and hyphens"
      );
    }

    if (/^[_-]/.test(trimmedUsername) || /[_-]$/.test(trimmedUsername)) {
      errors.push("Username cannot start or end with underscore or hyphen");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate email verification token (for Phase 2)
   */
  static async generateEmailVerificationToken(
    userId: string,
    email: string
  ): Promise<string> {
    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
    );

    const tokenEntity: EmailVerificationTokenEntity = {
      PK: `EMAIL_VERIFICATION#${token}`,
      SK: "METADATA",
      GSI1PK: "EMAIL_VERIFICATION_EXPIRY",
      GSI1SK: `${expiresAt.toISOString()}#${token}`,
      EntityType: "EmailVerificationToken",
      token,
      userId,
      email: email.toLowerCase(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttl: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp for TTL
    };

    await DynamoDBService.createEmailVerificationToken(tokenEntity);

    return token;
  }

  /**
   * Verify email verification token (for Phase 2)
   */
  static async verifyEmailToken(token: string): Promise<{
    isValid: boolean;
    userId?: string;
    email?: string;
  }> {
    const tokenEntity = await DynamoDBService.getEmailVerificationToken(token);

    if (!tokenEntity) {
      return { isValid: false };
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(tokenEntity.expiresAt);

    if (now > expiresAt) {
      // Clean up expired token
      await DynamoDBService.deleteEmailVerificationToken(token);
      return { isValid: false };
    }

    return {
      isValid: true,
      userId: tokenEntity.userId,
      email: tokenEntity.email,
    };
  }

  /**
   * Clean up expired email verification tokens (for Phase 2)
   */
  static async cleanupExpiredEmailTokens(): Promise<void> {
    await DynamoDBService.cleanupExpiredEmailTokens();
  }

  /**
   * Sanitize user data for API responses (remove sensitive fields)
   */
  static sanitizeUserForResponse(userEntity: UserEntity): {
    userId: string;
    email: string;
    username: string;
    createdAt: string;
    isActive: boolean;
    isEmailVerified: boolean;
    lastLoginAt?: string;
  } {
    const response: any = {
      userId: userEntity.userId,
      email: userEntity.email,
      username: userEntity.username,
      createdAt: userEntity.createdAt,
      isActive: userEntity.isActive,
      isEmailVerified: userEntity.isEmailVerified,
    };

    if (userEntity.lastLoginAt) {
      response.lastLoginAt = userEntity.lastLoginAt;
    }

    return response;
  }

  /**
   * Create a new Google OAuth user
   */
  static async createGoogleUser(
    googleId: string,
    email: string,
    firstName?: string,
    lastName?: string,
    isActive: boolean = true
  ): Promise<string> {
    // Check if Google ID already exists
    const existingGoogleUser = await DynamoDBService.getUserByGoogleId(
      googleId
    );
    if (existingGoogleUser) {
      throw new Error("Google account already linked to another user");
    }

    // Generate a unique username from email
    const baseUsername = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    let username = baseUsername;
    let counter = 1;

    // Ensure username is unique
    while (await DynamoDBService.getUserByUsername(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

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
    };

    await DynamoDBService.createUser(userEntity);

    return userId;
  }

  /**
   * Link Google OAuth to existing user account
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
   * Create or link Google OAuth user
   */
  static async createOrLinkGoogleUser(
    googleId: string,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<{ userId: string; isNewUser: boolean }> {
    // Check if user exists by email
    const existingEmailUser = await DynamoDBService.getUserByEmail(email);

    if (existingEmailUser) {
      // Link Google account to existing user
      await this.linkGoogleToUser(existingEmailUser.userId, googleId);

      return {
        userId: existingEmailUser.userId,
        isNewUser: false,
      };
    } else {
      // Create new Google user
      const userId = await this.createGoogleUser(
        googleId,
        email,
        firstName,
        lastName
      );

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
