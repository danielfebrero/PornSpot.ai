// Plan and subscription utilities
import { DynamoDBService } from "./dynamodb";
import {
  User,
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
  bonusGenerationCredits?: number;
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
        // Return default anonymous plan for non-existent users
        return {
          plan: "anonymous",
          isActive: true,
          subscriptionStatus: "active",
          planStartDate: new Date().toISOString(),
        };
      }

      // Extract plan info from user entity
      const isActivePlan =
        new Date(userEntity.planEndDate!).getTime() > Date.now() ||
        !userEntity.planEndDate;

      const planInfo: UserPlanInfo = {
        plan: isActivePlan ? userEntity.plan : "free",
        isActive:
          (userEntity.subscriptionStatus === "active" && isActivePlan) ||
          userEntity.plan === "free",
        subscriptionStatus:
          isActivePlan && userEntity.subscriptionStatus
            ? userEntity.subscriptionStatus
            : "active",
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
      // Return default anonymous plan on error
      return {
        plan: "anonymous",
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
    const today = now.toISOString().split("T")[0]!; // YYYY-MM-DD format

    // Check if monthly count needs to be reset
    let monthlyCount = user.imagesGeneratedThisMonth || 0;
    const lastGeneration = user.lastGenerationAt
      ? new Date(user.lastGenerationAt)
      : null;

    if (PlanUtil.shouldResetMonthlyCount(user, lastGeneration, now)) {
      monthlyCount = 0; // Reset for new billing cycle
    }

    // Check if daily count needs to be reset
    let dailyCount = user.imagesGeneratedToday || 0;
    if (lastGeneration) {
      const lastDay = lastGeneration.toISOString().split("T")[0];
      if (lastDay !== today) {
        dailyCount = 0; // Reset for new day
      }
    }

    const usageStats = {
      imagesGeneratedThisMonth: monthlyCount,
      imagesGeneratedToday: dailyCount,
      ...(user.lastGenerationAt && { lastGenerationAt: user.lastGenerationAt }),
    } as UserUsageStats;

    if (typeof user.bonusGenerationCredits === "number") {
      usageStats.bonusGenerationCredits = user.bonusGenerationCredits;
    }

    return usageStats;
  }

  /**
   * Convert a regular user entity to enhanced user with plan information
   */
  static async enhanceUser(userEntity: UserEntity): Promise<User> {
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
      emailPreferences: userEntity.emailPreferences,

      // Avatar information
      avatarUrl: userEntity.avatarUrl,
      avatarThumbnails: userEntity.avatarThumbnails,

      role,
      planInfo,
      usageStats,

      profileInsights: userEntity.profileInsights,
      followerCount: userEntity.followerCount || 0,

      // i2v credits
      i2vCreditsSecondsPurchased: userEntity.i2vCreditsSecondsPurchased,
      i2vCreditsSecondsFromPlan: userEntity.i2vCreditsSecondsFromPlan,
    };
  }

  /**
   * Update user usage statistics in database
   */
  static async updateUserUsageStats(
    userId: string,
    increment: number
  ): Promise<void> {
    try {
      const user = await DynamoDBService.getUserById(userId);
      if (!user) {
        console.error(`User not found for usage update: ${userId}`);
        return;
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0]; // YYYY-MM-DD format

      // Check if we need to reset monthly count (new month)
      let monthlyCount = user.imagesGeneratedThisMonth || 0;
      const lastGeneration = user.lastGenerationAt
        ? new Date(user.lastGenerationAt)
        : null;

      if (PlanUtil.shouldResetMonthlyCount(user, lastGeneration, now)) {
        monthlyCount = 0; // Reset for new billing cycle
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
      monthlyCount += increment;
      dailyCount += increment;

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

  private static shouldResetMonthlyCount(
    user: UserEntity,
    lastGeneration: Date | null,
    referenceDate: Date
  ): boolean {
    if (!lastGeneration) {
      return false;
    }

    const hasPaidPlan = user.plan && user.plan !== "free";
    if (hasPaidPlan && user.planStartDate) {
      const planStartDate = new Date(user.planStartDate);
      if (!Number.isNaN(planStartDate.getTime())) {
        const cycleStart = PlanUtil.calculatePlanCycleStart(
          planStartDate,
          referenceDate
        );
        if (lastGeneration < cycleStart) {
          return true;
        }
      }
    }

    return (
      lastGeneration.getMonth() !== referenceDate.getMonth() ||
      lastGeneration.getFullYear() !== referenceDate.getFullYear()
    );
  }

  private static calculatePlanCycleStart(
    planStartDate: Date,
    referenceDate: Date
  ): Date {
    const startTimestamp = planStartDate.getTime();
    if (Number.isNaN(startTimestamp)) {
      return planStartDate;
    }

    if (referenceDate <= planStartDate) {
      return planStartDate;
    }

    const totalMonths =
      (referenceDate.getUTCFullYear() - planStartDate.getUTCFullYear()) * 12 +
      (referenceDate.getUTCMonth() - planStartDate.getUTCMonth());

    let cycleStart = PlanUtil.addMonthsPreservingDay(
      planStartDate,
      totalMonths
    );

    if (cycleStart > referenceDate) {
      cycleStart = PlanUtil.addMonthsPreservingDay(
        planStartDate,
        totalMonths - 1
      );
    }

    return cycleStart <= planStartDate ? planStartDate : cycleStart;
  }

  private static addMonthsPreservingDay(date: Date, months: number): Date {
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth() + months;
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();

    const target = new Date(
      Date.UTC(year, monthIndex, 1, hours, minutes, seconds, milliseconds)
    );
    const daysInTargetMonth = PlanUtil.getDaysInUTCMonth(
      target.getUTCFullYear(),
      target.getUTCMonth()
    );
    const clampedDay = Math.min(date.getUTCDate(), daysInTargetMonth);
    target.setUTCDate(clampedDay);
    return target;
  }

  private static getDaysInUTCMonth(year: number, monthIndex: number): number {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }
}
