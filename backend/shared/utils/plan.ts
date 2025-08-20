// Plan and subscription utilities
import { DynamoDBService } from "./dynamodb";
import {
  UserEntity,
  UserPlan,
  UserProfileInsights,
  UserRole,
} from "@shared/shared-types";

export interface UserPlanInfo {
  plan: UserPlan;
  isActive: boolean;
  subscriptionId?: string;
  subscriptionStatus?: "active" | "canceled" | "expired";
  planStartDate?: string;
  planEndDate?: string;
}

export interface UserUsageStats {
  imagesGeneratedThisMonth: number;
  imagesGeneratedToday: number;
  lastGenerationAt?: string;
}

export interface EnhancedUser {
  userId: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  lastActive?: string; // Last time user was seen active
  googleId?: string;
  preferredLanguage?: string;

  // Avatar information
  avatarUrl?: string;
  avatarThumbnails?: {
    originalSize?: string;
    small?: string;
    medium?: string;
    large?: string;
  };

  role: UserRole;
  planInfo: UserPlanInfo;
  usageStats: UserUsageStats;

  profileInsights?: UserProfileInsights;
}

export class PlanUtil {
  /**
   * Get user plan information from database
   */
  static async getUserPlanInfo(userId: string): Promise<UserPlanInfo> {
    try {
      const userEntity = await DynamoDBService.getUserById(userId);

      if (!userEntity) {
        // Return default free plan for non-existent users
        return {
          plan: "free",
          isActive: true,
          subscriptionStatus: "active",
          planStartDate: new Date().toISOString(),
        };
      }

      // Extract plan info from user entity
      const planInfo: UserPlanInfo = {
        plan: userEntity.plan || "free",
        isActive:
          userEntity.subscriptionStatus === "active" ||
          userEntity.plan === "free",
        subscriptionStatus: userEntity.subscriptionStatus || "active",
        planStartDate: userEntity.planStartDate || userEntity.createdAt,
      };

      // Only include optional fields if they exist
      if (userEntity.subscriptionId) {
        planInfo.subscriptionId = userEntity.subscriptionId;
      }
      if (userEntity.planEndDate) {
        planInfo.planEndDate = userEntity.planEndDate;
      }

      return planInfo;
    } catch (error) {
      console.error("Error getting user plan info:", error);
      // Return default free plan on error
      return {
        plan: "free",
        isActive: true,
        subscriptionStatus: "active",
        planStartDate: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user role from database
   */
  static async getUserRole(userId: string): Promise<UserRole> {
    try {
      const userEntity = await DynamoDBService.getUserById(userId);

      if (userEntity && userEntity.role) {
        return userEntity.role;
      }

      return "user";
    } catch (error) {
      console.error("Error getting user role:", error);
      return "user"; // Default to regular user on error
    }
  }

  /**
   * Get user usage statistics from database
   */
  static async getUserUsageStats(user: UserEntity): Promise<UserUsageStats> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split("T")[0]!; // YYYY-MM-DD format

    // Check if monthly count needs to be reset
    let monthlyCount = user.imagesGeneratedThisMonth || 0;
    const lastGeneration = user.lastGenerationAt
      ? new Date(user.lastGenerationAt)
      : null;

    if (lastGeneration) {
      const lastMonth = lastGeneration.getMonth();
      const lastYear = lastGeneration.getFullYear();
      if (lastMonth !== currentMonth || lastYear !== currentYear) {
        monthlyCount = 0; // Reset for new month
      }
    }

    // Check if daily count needs to be reset
    let dailyCount = user.imagesGeneratedToday || 0;
    if (lastGeneration) {
      const lastDay = lastGeneration.toISOString().split("T")[0];
      if (lastDay !== today) {
        dailyCount = 0; // Reset for new day
      }
    }

    return {
      imagesGeneratedThisMonth: monthlyCount,
      imagesGeneratedToday: dailyCount,
      ...(user.lastGenerationAt && { lastGenerationAt: user.lastGenerationAt }),
    };
  }

  /**
   * Convert a regular user entity to enhanced user with plan information
   */
  static async enhanceUser(userEntity: UserEntity): Promise<EnhancedUser> {
    const planInfo = await this.getUserPlanInfo(userEntity.userId);
    const role = await this.getUserRole(userEntity.userId);
    const usageStats = await this.getUserUsageStats(userEntity);

    return {
      userId: userEntity.userId,
      email: userEntity.email,
      username: userEntity.username,
      firstName: userEntity.firstName,
      lastName: userEntity.lastName,
      bio: userEntity.bio,
      location: userEntity.location,
      website: userEntity.website,
      createdAt: userEntity.createdAt,
      isActive: userEntity.isActive,
      isEmailVerified: userEntity.isEmailVerified,
      lastLoginAt: userEntity.lastLoginAt,
      lastActive: userEntity.lastActive,
      googleId: userEntity.googleId,
      preferredLanguage: userEntity.preferredLanguage,

      // Avatar information
      avatarUrl: userEntity.avatarUrl,
      avatarThumbnails: userEntity.avatarThumbnails,

      role,
      planInfo,
      usageStats,

      profileInsights: userEntity.profileInsights,
    };
  }

  /**
   * Update user usage statistics in database
   */
  static async updateUserUsageStats(userId: string): Promise<void> {
    try {
      const user = await DynamoDBService.getUserById(userId);
      if (!user) {
        console.error(`User not found for usage update: ${userId}`);
        return;
      }

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const today = now.toISOString().split("T")[0]; // YYYY-MM-DD format

      // Check if we need to reset monthly count (new month)
      let monthlyCount = user.imagesGeneratedThisMonth || 0;
      const lastGeneration = user.lastGenerationAt
        ? new Date(user.lastGenerationAt)
        : null;

      if (lastGeneration) {
        const lastMonth = lastGeneration.getMonth();
        const lastYear = lastGeneration.getFullYear();
        if (lastMonth !== currentMonth || lastYear !== currentYear) {
          monthlyCount = 0; // Reset for new month
        }
      }

      // Check if we need to reset daily count (new day)
      let dailyCount = user.imagesGeneratedToday || 0;
      if (lastGeneration) {
        const lastDay = lastGeneration.toISOString().split("T")[0];
        if (lastDay !== today) {
          dailyCount = 0; // Reset for new day
        }
      }

      // Increment counts
      monthlyCount += 1;
      dailyCount += 1;

      // Update user in database
      await DynamoDBService.updateUser(userId, {
        imagesGeneratedThisMonth: monthlyCount,
        imagesGeneratedToday: dailyCount,
        lastGenerationAt: now.toISOString(),
      });

      console.log(
        `Updated usage stats for user ${userId}: monthly=${monthlyCount}, daily=${dailyCount}`
      );
    } catch (error) {
      console.error(`Failed to update usage stats for user ${userId}:`, error);
    }
  }
}
