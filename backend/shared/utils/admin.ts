import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";
import { DynamoDBService } from "./dynamodb";
import { AdminUserEntity } from "@shared/shared-types";

const SALT_ROUNDS = 12;

export class AdminUtil {
  /**
   * Create a new admin user with hashed password
   */
  static async createAdminUser(
    username: string,
    password: string,
    isActive: boolean = true
  ): Promise<string> {
    // Check if username already exists
    const existingAdmin = await DynamoDBService.getAdminByUsername(username);
    if (existingAdmin) {
      throw new Error("Username already exists");
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    const adminId = uuidv4();
    const now = new Date().toISOString();

    const adminEntity: AdminUserEntity = {
      PK: `ADMIN#${adminId}`,
      SK: "METADATA",
      GSI1PK: "ADMIN_USERNAME",
      GSI1SK: username,
      EntityType: "AdminUser",
      adminId,
      username,
      passwordHash,
      salt,
      createdAt: now,
      isActive,
    };

    await DynamoDBService.createAdminUser(adminEntity);

    return adminId;
  }

  /**
   * Update admin password
   */
  static async updateAdminPassword(
    adminId: string,
    newPassword: string
  ): Promise<void> {
    const admin = await DynamoDBService.getAdminById(adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    // Generate new salt and hash
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Note: This would require implementing updateAdmin in DynamoDBService
    // For now, we'll create a new entity to replace the old one
    const newAdminEntity: AdminUserEntity = {
      ...admin,
      passwordHash,
      salt,
    };

    await DynamoDBService.createAdminUser(newAdminEntity);
  }

  /**
   * Deactivate an admin user
   */
  static async deactivateAdmin(adminId: string): Promise<void> {
    const admin = await DynamoDBService.getAdminById(adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const updatedAdmin: AdminUserEntity = {
      ...admin,
      isActive: false,
    };

    await DynamoDBService.createAdminUser(updatedAdmin);
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
}
