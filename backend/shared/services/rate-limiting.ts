/*
File objective: Rate limiting service for ComfyUI requests based on user plans
Auth: Used by generation services to enforce plan-based request limits
Special notes:
- Simple implementation using in-memory tracking for MVP
- Will be enhanced with DynamoDB persistence in production
- Integrates with existing user plan system
*/

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number | "unlimited";
  resetTime: number; // Unix timestamp
  reason?: string;
}

export interface RateLimitConfig {
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  requestsPerMonth: number;
}

interface UserRateLimitData {
  concurrent: number;
  minuteRequests: Map<number, number>; // minute timestamp -> count
  hourRequests: Map<number, number>; // hour timestamp -> count
  dayRequests: Map<number, number>; // day timestamp -> count
  monthRequests: Map<string, number>; // month string -> count
}

/**
 * Rate limiting service for ComfyUI generation requests
 * Using in-memory tracking for simplicity (MVP implementation)
 */
export class RateLimitingService {
  private static instance: RateLimitingService;
  private userLimits: Map<string, UserRateLimitData> = new Map();

  /**
   * Gets the singleton instance
   */
  static getInstance(): RateLimitingService {
    if (!RateLimitingService.instance) {
      RateLimitingService.instance = new RateLimitingService();
    }
    return RateLimitingService.instance;
  }

  /**
   * Checks if a user can make a generation request
   */
  async checkRateLimit(
    userId: string,
    userPlan: string
  ): Promise<RateLimitResult> {
    try {
      const config = this.getRateLimitConfig(userPlan);
      const now = Date.now();

      // Initialize user data if not exists
      if (!this.userLimits.has(userId)) {
        this.userLimits.set(userId, {
          concurrent: 0,
          minuteRequests: new Map(),
          hourRequests: new Map(),
          dayRequests: new Map(),
          monthRequests: new Map(),
        });
      }

      const userData = this.userLimits.get(userId)!;

      // Check concurrent requests
      if (userData.concurrent >= config.maxConcurrentRequests) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: now + 60000, // Try again in 1 minute
          reason: "Too many concurrent requests",
        };
      }

      // Check per-minute rate limit
      if (config.requestsPerMinute > 0) {
        const currentMinute = Math.floor(now / 60000);
        const minuteCount = userData.minuteRequests.get(currentMinute) || 0;
        if (minuteCount >= config.requestsPerMinute) {
          return {
            allowed: false,
            remainingRequests: config.requestsPerMinute - minuteCount,
            resetTime: (currentMinute + 1) * 60000,
            reason: "Per-minute rate limit exceeded",
          };
        }
      }

      // Check per-hour rate limit
      if (config.requestsPerHour > 0) {
        const currentHour = Math.floor(now / 3600000);
        const hourCount = userData.hourRequests.get(currentHour) || 0;
        if (hourCount >= config.requestsPerHour) {
          return {
            allowed: false,
            remainingRequests: config.requestsPerHour - hourCount,
            resetTime: (currentHour + 1) * 3600000,
            reason: "Per-hour rate limit exceeded",
          };
        }
      }

      // Check per-day rate limit
      if (config.requestsPerDay > 0) {
        const currentDay = Math.floor(now / 86400000);
        const dayCount = userData.dayRequests.get(currentDay) || 0;
        if (dayCount >= config.requestsPerDay) {
          return {
            allowed: false,
            remainingRequests: config.requestsPerDay - dayCount,
            resetTime: (currentDay + 1) * 86400000,
            reason: "Daily rate limit exceeded",
          };
        }
      }

      // Check per-month rate limit
      if (config.requestsPerMonth > 0) {
        const currentMonth = this.getMonthKey(now);
        const monthCount = userData.monthRequests.get(currentMonth) || 0;
        if (monthCount >= config.requestsPerMonth) {
          return {
            allowed: false,
            remainingRequests: config.requestsPerMonth - monthCount,
            resetTime: this.getNextMonthTimestamp(now),
            reason: "Monthly rate limit exceeded",
          };
        }
      }

      // All checks passed
      const remainingRequests = this.calculateRemainingRequests(
        userData,
        config,
        now
      );

      return {
        allowed: true,
        remainingRequests,
        resetTime: Math.floor(now / 60000 + 1) * 60000, // Next minute
      };
    } catch (error) {
      console.error("Rate limit check failed:", error);
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: Date.now() + 60000,
        reason: "Rate limit check error",
      };
    }
  }

  /**
   * Records the start of a generation request
   */
  async startRequest(userId: string): Promise<void> {
    const userData = this.userLimits.get(userId);
    if (!userData) return;

    const now = Date.now();

    // Increment concurrent requests
    userData.concurrent++;

    // Record requests in time buckets
    const currentMinute = Math.floor(now / 60000);
    const currentHour = Math.floor(now / 3600000);
    const currentDay = Math.floor(now / 86400000);
    const currentMonth = this.getMonthKey(now);

    userData.minuteRequests.set(
      currentMinute,
      (userData.minuteRequests.get(currentMinute) || 0) + 1
    );
    userData.hourRequests.set(
      currentHour,
      (userData.hourRequests.get(currentHour) || 0) + 1
    );
    userData.dayRequests.set(
      currentDay,
      (userData.dayRequests.get(currentDay) || 0) + 1
    );
    userData.monthRequests.set(
      currentMonth,
      (userData.monthRequests.get(currentMonth) || 0) + 1
    );

    // Clean up old entries
    this.cleanupOldEntries(userData, now);
  }

  /**
   * Records the completion of a generation request
   */
  async endRequest(userId: string): Promise<void> {
    const userData = this.userLimits.get(userId);
    if (userData && userData.concurrent > 0) {
      userData.concurrent--;
    }
  }

  /**
   * Gets rate limit configuration based on user plan
   */
  private getRateLimitConfig(userPlan: string): RateLimitConfig {
    switch (userPlan) {
      case "free":
        return {
          maxConcurrentRequests: 1,
          requestsPerMinute: 1,
          requestsPerHour: 5,
          requestsPerDay: 1,
          requestsPerMonth: 30,
        };

      case "starter":
        return {
          maxConcurrentRequests: 2,
          requestsPerMinute: 3,
          requestsPerHour: 30,
          requestsPerDay: 50,
          requestsPerMonth: 300,
        };

      case "pro":
        return {
          maxConcurrentRequests: 5,
          requestsPerMinute: 10,
          requestsPerHour: 200,
          requestsPerDay: -1, // unlimited
          requestsPerMonth: -1, // unlimited
        };

      case "unlimited":
        return {
          maxConcurrentRequests: 10,
          requestsPerMinute: -1, // unlimited
          requestsPerHour: -1, // unlimited
          requestsPerDay: -1, // unlimited
          requestsPerMonth: -1, // unlimited
        };

      default:
        return this.getRateLimitConfig("free");
    }
  }

  /**
   * Calculates remaining requests for the most restrictive limit
   */
  private calculateRemainingRequests(
    userData: UserRateLimitData,
    config: RateLimitConfig,
    now: number
  ): number | "unlimited" {
    const limits: number[] = [];

    if (config.requestsPerMinute > 0) {
      const currentMinute = Math.floor(now / 60000);
      const used = userData.minuteRequests.get(currentMinute) || 0;
      limits.push(config.requestsPerMinute - used);
    }

    if (config.requestsPerHour > 0) {
      const currentHour = Math.floor(now / 3600000);
      const used = userData.hourRequests.get(currentHour) || 0;
      limits.push(config.requestsPerHour - used);
    }

    if (config.requestsPerDay > 0) {
      const currentDay = Math.floor(now / 86400000);
      const used = userData.dayRequests.get(currentDay) || 0;
      limits.push(config.requestsPerDay - used);
    }

    if (config.requestsPerMonth > 0) {
      const currentMonth = this.getMonthKey(now);
      const used = userData.monthRequests.get(currentMonth) || 0;
      limits.push(config.requestsPerMonth - used);
    }

    if (limits.length === 0) {
      return "unlimited";
    }

    return Math.max(0, Math.min(...limits));
  }

  /**
   * Gets month key for tracking monthly limits
   */
  private getMonthKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
  }

  /**
   * Gets timestamp for the next month boundary
   */
  private getNextMonthTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return nextMonth.getTime();
  }

  /**
   * Cleans up old tracking entries to prevent memory leaks
   */
  private cleanupOldEntries(userData: UserRateLimitData, now: number): void {
    const currentMinute = Math.floor(now / 60000);
    const currentHour = Math.floor(now / 3600000);
    const currentDay = Math.floor(now / 86400000);
    const currentMonth = this.getMonthKey(now);

    // Keep only recent entries
    for (const [minute] of userData.minuteRequests.entries()) {
      if (minute < currentMinute - 2) {
        // Keep last 2 minutes
        userData.minuteRequests.delete(minute);
      }
    }

    for (const [hour] of userData.hourRequests.entries()) {
      if (hour < currentHour - 2) {
        // Keep last 2 hours
        userData.hourRequests.delete(hour);
      }
    }

    for (const [day] of userData.dayRequests.entries()) {
      if (day < currentDay - 2) {
        // Keep last 2 days
        userData.dayRequests.delete(day);
      }
    }

    // Keep only current and previous month
    const prevMonth = this.getMonthKey(now - 31 * 24 * 60 * 60 * 1000);
    for (const [month] of userData.monthRequests.entries()) {
      if (month !== currentMonth && month !== prevMonth) {
        userData.monthRequests.delete(month);
      }
    }
  }

  /**
   * Resets rate limits for a user (useful for testing)
   */
  resetUserLimits(userId: string): void {
    this.userLimits.delete(userId);
  }

  /**
   * Gets current rate limit status for a user
   */
  getUserStatus(userId: string): {
    concurrent: number;
    minuteRequests: number;
    hourRequests: number;
    dayRequests: number;
    monthRequests: number;
  } {
    const userData = this.userLimits.get(userId);
    if (!userData) {
      return {
        concurrent: 0,
        minuteRequests: 0,
        hourRequests: 0,
        dayRequests: 0,
        monthRequests: 0,
      };
    }

    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const currentHour = Math.floor(now / 3600000);
    const currentDay = Math.floor(now / 86400000);
    const currentMonth = this.getMonthKey(now);

    return {
      concurrent: userData.concurrent,
      minuteRequests: userData.minuteRequests.get(currentMinute) || 0,
      hourRequests: userData.hourRequests.get(currentHour) || 0,
      dayRequests: userData.dayRequests.get(currentDay) || 0,
      monthRequests: userData.monthRequests.get(currentMonth) || 0,
    };
  }
}

/**
 * Convenience function to get the rate limiting service instance
 */
export function getRateLimitingService(): RateLimitingService {
  return RateLimitingService.getInstance();
}
