/**
 * @fileoverview Simple Rate Limiting Service
 * @description Enforces generation limits based on user plan, concurrent generations, IP quotas, and anonymous restrictions.
 * @notes
 * - Checks concurrent (one at a time), daily/monthly quotas, IP limits to prevent abuse.
 * - Temporary unlimited quota until Sep 30, 2025 for registered users.
 * - Records generations for IP and user with union counting.
 * - Anonymous: 1 per IP per day.
 * - Uses GenerationQueueService and DynamoDB for counting.
 * - Returns SimplifiedRateLimitResult with allowed/reason/remaining.
 */
/**
 * @fileoverview Simple Rate Limiting Service
 * @description Enforces generation limits based on user plan, concurrent generations, IP quotas, and anonymous restrictions.
 * @notes
 * - Checks concurrent (one at a time), daily/monthly quotas, IP limits to prevent abuse.
 * - Temporary unlimited quota until Sep 30, 2025 for registered users.
 * - Records generations for IP and user with union counting.
 * - Anonymous: 1 per IP per day.
 * - Uses GenerationQueueService and DynamoDB for counting.
 * - Returns SimplifiedRateLimitResult with allowed/reason/remaining.
 */
import { APIGatewayProxyEvent } from "aws-lambda";
import { GenerationQueueService } from "./generation-queue";
import { DynamoDBService } from "../utils/dynamodb";
import { extractClientIP } from "../utils/ip-extraction";
import { createHash } from "crypto";
import { User, UserPlan } from "@shared/shared-types";
import { ParameterStoreService } from "@shared";

export interface SimplifiedRateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: number | "unlimited";
}

/**
 * Simplified rate limiting service that enforces:
 * 1. One generation at a time per user (pending/processing check)
 * 2. Daily/monthly quota based on usage stats
 * 3. IP-based quota check for all users (to prevent multi-account abuse)
 * 4. Anonymous users: one request per IP per day
 *
 * TEMPORARY CHANGE: Until September 30, 2025, all registered users (except anonymous)
 * receive unlimited quota regardless of their plan. This is a promotional period.
 * After this date, normal plan-based quotas will be enforced.
 */
export class SimplifiedRateLimitingService {
  private static instance: SimplifiedRateLimitingService;
  private queueService: GenerationQueueService;

  private constructor() {
    this.queueService = GenerationQueueService.getInstance();
  }

  public static getInstance(): SimplifiedRateLimitingService {
    if (!this.instance) {
      this.instance = new SimplifiedRateLimitingService();
    }
    return this.instance;
  }

  /**
   * Main rate limit check for both authenticated and anonymous users
   */
  async checkRateLimit(
    event: APIGatewayProxyEvent,
    user?: User
  ): Promise<SimplifiedRateLimitResult> {
    try {
      // Check for authenticated users
      if (user) {
        const plan = user.planInfo?.plan ?? "anonymous";

        // 1. Check for pending/processing generations (one at a time)
        const concurrentCheck = await this.checkConcurrentGeneration(
          user.userId
        );
        if (!concurrentCheck.allowed) {
          return concurrentCheck;
        }

        const bonusCredits = user.usageStats?.bonusGenerationCredits ?? 0;

        if (bonusCredits > 0) {
          return {
            allowed: true,
            remaining: bonusCredits,
          };
        }

        // 2. Check daily/monthly quota based on plan
        const quotaCheck = await this.checkUserQuota(user.userId, plan, event);
        if (!quotaCheck.allowed) {
          return quotaCheck;
        }

        // 3. Check IP-based quota (prevent multi-account abuse)
        const ipQuotaCheck = await this.checkIPQuotaForUser(
          event,
          plan,
          user.userId
        );
        if (!ipQuotaCheck.allowed) {
          return ipQuotaCheck;
        }

        return {
          allowed: true,
          remaining:
            Math.min(
              quotaCheck.remaining === "unlimited"
                ? Infinity
                : (quotaCheck.remaining as number),
              ipQuotaCheck.remaining === "unlimited"
                ? Infinity
                : (ipQuotaCheck.remaining as number)
            ) === Infinity
              ? "unlimited"
              : Math.min(
                  quotaCheck.remaining === "unlimited"
                    ? Infinity
                    : (quotaCheck.remaining as number),
                  ipQuotaCheck.remaining === "unlimited"
                    ? Infinity
                    : (ipQuotaCheck.remaining as number)
                ),
        };
      } else {
        // Anonymous user - check IP limit (1 per day)
        return await this.checkAnonymousIPLimit(event);
      }
    } catch (error) {
      console.error("Rate limit check failed:", error);
      // Fail open to avoid blocking legitimate requests
      return { allowed: true };
    }
  }

  /**
   * Record generation for both authenticated and anonymous users
   * Records both IP and user tracking with cross-references to enable union-based counting
   */
  async recordGeneration(
    event: APIGatewayProxyEvent,
    user?: {
      userId: string;
      plan: string;
      bonusGenerationCredits?: number;
    },
    batchCount: number = 1
  ): Promise<void> {
    try {
      const clientIP = extractClientIP(event);
      const today = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();

      if (user) {
        // For authenticated users, record both IP and user tracking with cross-references
        for (let i = 0; i < batchCount; i++) {
          const generationId = `${now}#${i}`;

          // Record IP generation with userId for union counting
          const ipRecord = {
            PK: `IP#${clientIP}`,
            SK: `GEN#${today}#${generationId}`,
            GSI1PK: `IP#${clientIP}`,
            GSI1SK: today,
            userId: user.userId,
            plan: user.plan,
            generatedAt: now,
            ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days retention
          };

          // Record user generation with IP for union counting
          const userRecord = {
            PK: `USER#${user.userId}`,
            SK: `GEN#${today}#${generationId}`,
            GSI1PK: `USER#${user.userId}`,
            GSI1SK: today,
            hashedIP: clientIP,
            plan: user.plan,
            generatedAt: now,
            ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days retention
          };

          await DynamoDBService.createIPGenerationRecord(ipRecord);
          await DynamoDBService.createUserGenerationRecord(userRecord);
        }
        console.log(
          `Recorded ${batchCount} generations - IP: ${clientIP}..., User: ${user.userId}`
        );

        if ((user.bonusGenerationCredits ?? 0) > 0) {
          const remainingBonusCredits =
            await DynamoDBService.consumeBonusGenerationCredits(
              user.userId,
              batchCount,
              user.bonusGenerationCredits
            );

          user.bonusGenerationCredits = remainingBonusCredits;
        }
      } else {
        // For anonymous users, record only IP generation
        for (let i = 0; i < batchCount; i++) {
          const generationId = `${now}#${i}`;

          const ipRecord = {
            PK: `IP#${clientIP}`,
            SK: `GEN#${today}#${generationId}`,
            GSI1PK: `IP#${clientIP}`,
            GSI1SK: today,
            generatedAt: now,
            ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days retention for anonymous
          };

          await DynamoDBService.createIPGenerationRecord(ipRecord);
        }
        console.log(
          `Recorded ${batchCount} anonymous generations for IP: ${clientIP}...`
        );
      }
    } catch (error) {
      console.error("Failed to record generation:", error);
      // Don't throw - this shouldn't block the generation
    }
  }

  /**
   * Check if user has pending or processing generations (one at a time rule)
   */
  private async checkConcurrentGeneration(
    userId: string
  ): Promise<SimplifiedRateLimitResult> {
    try {
      const pendingCount = await this.queueService.getUserPendingCount(userId);
      const processingCount = await this.queueService.getUserProcessingCount(
        userId
      );

      if (pendingCount > 0 || processingCount > 0) {
        return {
          allowed: false,
          reason:
            "You can only generate one image at a time. Please wait for your current generation to complete.",
          remaining: 0,
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error("Error checking concurrent generations:", error);
      // On error, allow the generation to proceed
      return { allowed: true };
    }
  }

  /**
   * Check user quota based on their plan
   * Uses union-based counting to avoid double-counting generations
   */
  private async checkUserQuota(
    userId: string,
    plan: UserPlan,
    event: APIGatewayProxyEvent
  ): Promise<SimplifiedRateLimitResult> {
    try {
      const activePromotions =
        await ParameterStoreService.getActivePromotions();
      const activePromotionsArray = activePromotions
        .split(",")
        .map((p) => p.trim());
      const isPromotionActive = activePromotionsArray.includes(
        "all_plans_pro_features"
      );

      if (isPromotionActive) {
        return { allowed: true, remaining: "unlimited" };
      }

      // Pro and unlimited plans have no limits
      if (plan === "pro" || plan === "unlimited") {
        return { allowed: true, remaining: "unlimited" };
      }

      const clientIP = extractClientIP(event);
      const hashedIP = createHash("sha256").update(clientIP).digest("hex");
      const today = new Date().toISOString().split("T")[0] as string;

      // Define limits based on plan
      const limits = {
        anonymous: { daily: 1, monthly: 30 },
        free: { daily: 1, monthly: 30 },
        starter: { daily: 200, monthly: 200 },
      };

      const planLimits = limits[plan];

      // Count distinct generations for this user today (using union-based counting)
      const dailyUsage = await DynamoDBService.countDistinctGenerationsForUser(
        userId,
        hashedIP,
        today,
        today
      );

      // Count distinct generations for this user this month
      const monthStart = `${today.substring(0, 7)}-01`; // YYYY-MM-01
      const monthlyUsage =
        await DynamoDBService.countDistinctGenerationsForUser(
          userId,
          hashedIP,
          monthStart,
          today
        );

      // Check daily limit
      if (dailyUsage >= planLimits.daily) {
        return {
          allowed: false,
          reason: `Daily limit reached (${planLimits.daily} images per day for ${plan} plan)`,
          remaining: 0,
        };
      }

      // Check monthly limit
      if (monthlyUsage >= planLimits.monthly) {
        return {
          allowed: false,
          reason: `Monthly limit reached (${planLimits.monthly} images per month for ${plan} plan)`,
          remaining: 0,
        };
      }

      // Return the most restrictive remaining count
      const dailyRemaining = planLimits.daily - dailyUsage;
      const monthlyRemaining = planLimits.monthly - monthlyUsage;

      return {
        allowed: true,
        remaining: Math.min(dailyRemaining, monthlyRemaining),
      };
    } catch (error) {
      console.error("Error checking user quota:", error);
      // On error, allow the generation to proceed
      return { allowed: true };
    }
  }

  /**
   * Check IP-based quota for authenticated users (prevents multi-account abuse)
   * Uses union-based counting to avoid double-counting generations
   */
  private async checkIPQuotaForUser(
    event: APIGatewayProxyEvent,
    plan: UserPlan,
    userId: string
  ): Promise<SimplifiedRateLimitResult> {
    try {
      const activePromotions =
        await ParameterStoreService.getActivePromotions();
      const activePromotionsArray = activePromotions
        .split(",")
        .map((p) => p.trim());
      const isPromotionActive = activePromotionsArray.includes(
        "all_plans_pro_features"
      );

      if (isPromotionActive) {
        return { allowed: true, remaining: "unlimited" };
      }

      // Pro and unlimited plans have no IP limits
      if (plan === "pro" || plan === "unlimited") {
        return { allowed: true, remaining: "unlimited" };
      }

      const clientIP = extractClientIP(event);
      const today = new Date().toISOString().split("T")[0]; // Always defined

      // Define IP limits based on plan (same as user limits to prevent abuse)
      const ipLimits = {
        anonymous: { daily: 1, monthly: 30 },
        free: { daily: 1, monthly: 30 },
        starter: { daily: 200, monthly: 200 },
      };

      const planLimits = ipLimits[plan];

      // Count distinct generations for this IP today (using union-based counting)
      const dailyGenerations =
        await DynamoDBService.countDistinctGenerationsForIP(
          clientIP,
          userId,
          today as string,
          today as string
        );

      // Count distinct generations for this IP this month
      const monthStart = `${today?.substring(0, 7)}-01`; // YYYY-MM-01
      const monthlyGenerations =
        await DynamoDBService.countDistinctGenerationsForIP(
          clientIP,
          userId,
          monthStart,
          today as string
        );

      // Check daily IP limit
      if (dailyGenerations >= planLimits.daily) {
        return {
          allowed: false,
          reason: `IP daily limit reached (${planLimits.daily} images per day per IP for ${plan} plan). This prevents multi-account abuse.`,
          remaining: 0,
        };
      }

      // Check monthly IP limit
      if (monthlyGenerations >= planLimits.monthly) {
        return {
          allowed: false,
          reason: `IP monthly limit reached (${planLimits.monthly} images per month per IP for ${plan} plan). This prevents multi-account abuse.`,
          remaining: 0,
        };
      }

      // Return the most restrictive remaining count
      const dailyRemaining = planLimits.daily - dailyGenerations;
      const monthlyRemaining = planLimits.monthly - monthlyGenerations;

      return {
        allowed: true,
        remaining: Math.min(dailyRemaining, monthlyRemaining),
      };
    } catch (error) {
      console.error("Error checking IP quota for user:", error);
      // On error, allow the generation to proceed
      return { allowed: true };
    }
  }

  /**
   * Check anonymous IP generation limit (1 per IP per day)
   */
  private async checkAnonymousIPLimit(
    event: APIGatewayProxyEvent
  ): Promise<SimplifiedRateLimitResult> {
    try {
      const clientIP = extractClientIP(event);
      const today = new Date().toISOString().split("T")[0] as string; // Assert it's a string

      // Count generations for this IP today using the new GEN# format
      const dailyGenerations = await DynamoDBService.countIPGenerations(
        clientIP,
        today,
        today
      );
      console.log("Daily generations for anonymous IP:", dailyGenerations);

      if (dailyGenerations > 0) {
        return {
          allowed: false,
          reason:
            "Anonymous users can only generate one image per day per IP address",
          remaining: 0,
        };
      }

      return { allowed: true, remaining: 1 };
    } catch (error) {
      console.error("Error checking anonymous IP limit:", error);
      // On error, allow the generation to proceed
      return { allowed: true };
    }
  }
}
