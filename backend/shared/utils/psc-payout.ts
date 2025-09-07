/**
 * @fileoverview PornSpotCoin Payout Utility
 * @description Utilities for calculating and processing PSC rewards based on user interactions.
 * @notes
 * - Dynamic rate calculation based on daily budget and activity
 * - Payout processing for views, likes, comments, bookmarks, uploads
 * - Budget management and rate tracking
 * - Integration with existing interaction system
 */

import { DynamoDBService } from "./dynamodb";
import {
  PayoutEvent,
  PayoutCalculation,
  DailyBudgetEntity,
  PSCSystemConfig,
  TransactionEntity,
  TransactionType,
} from "@shared/shared-types";
import { v4 as uuidv4 } from "uuid";
import { PSCTransactionService } from "./psc-transactions";

export class PSCPayoutService {
  // Default system configuration
  private static readonly DEFAULT_CONFIG: PSCSystemConfig = {
    dailyBudgetAmount: 33.0, // 33 PSC per day
    minimumPayoutAmount: 0.000000001, // Minimum 0.000000001 PSC payout
    maxPayoutPerAction: 1000, // Maximum 1000 PSC per action
    rateWeights: {
      view: 1, // Base weight for views
      like: 6, // 6x weight for likes
      comment: 10, // 10x weight for comments
      bookmark: 8, // 8x weight for bookmarks
      profileView: 4, // 4x weight for profile views
    },
    enableRewards: true,
    enableUserToUserTransfers: true,
    enableWithdrawals: false, // Start with withdrawals disabled
  };

  /**
   * Get current system configuration
   */
  static async getSystemConfig(): Promise<PSCSystemConfig> {
    try {
      // Import DynamoDBService dynamically to avoid circular dependency
      const config = await DynamoDBService.getPSCConfig();

      if (config) {
        return config;
      }

      // If no config exists in database, return default and save it
      const defaultConfig = { ...PSCPayoutService.DEFAULT_CONFIG };
      await DynamoDBService.savePSCConfig(defaultConfig);
      return defaultConfig;
    } catch (error) {
      console.warn(
        "Failed to load PSC config from database, using defaults:",
        error
      );
      return { ...PSCPayoutService.DEFAULT_CONFIG };
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private static getTodayDateString(): string {
    const dateString = new Date().toISOString().split("T")[0];
    if (!dateString) {
      throw new Error("Failed to get today's date");
    }
    return dateString;
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private static getYesterdayDateString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split("T")[0];
    if (!dateString) {
      throw new Error("Failed to get yesterday's date");
    }
    return dateString;
  }

  /**
   * Get or create daily budget entity for today
   */
  static async getTodaysBudget(): Promise<DailyBudgetEntity> {
    const today = PSCPayoutService.getTodayDateString();
    const config = await PSCPayoutService.getSystemConfig();

    try {
      // Try to get existing budget
      const existing = await DynamoDBService.getBudgetByDate(today);
      if (existing) {
        return existing;
      }
    } catch (error) {
      // Budget doesn't exist, create new one
    }

    // Create new daily budget
    const newBudget: DailyBudgetEntity = {
      PK: `PSC_BUDGET#${today}`,
      SK: "METADATA",
      GSI1PK: "PSC_BUDGET",
      GSI1SK: today,
      EntityType: "DailyBudget",
      date: today,
      totalBudget: config.dailyBudgetAmount,
      remainingBudget: config.dailyBudgetAmount,
      distributedBudget: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalBookmarks: 0,
      totalProfileViews: 0,
      currentRates: {
        viewRate: 0,
        likeRate: 0,
        commentRate: 0,
        bookmarkRate: 0,
        profileViewRate: 0,
      },
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await DynamoDBService.createDailyBudget(newBudget);
    return newBudget;
  }

  /**
   * Calculate current rates based on activity and remaining budget
   */
  static async calculateCurrentRates(
    budget: DailyBudgetEntity,
    config: PSCSystemConfig
  ): Promise<DailyBudgetEntity["currentRates"]> {
    const totalWeightedActivity =
      budget.totalViews * config.rateWeights.view +
      budget.totalLikes * config.rateWeights.like +
      budget.totalComments * config.rateWeights.comment +
      budget.totalBookmarks * config.rateWeights.bookmark +
      budget.totalProfileViews * config.rateWeights.profileView;

    // If no activity yet, set initial rates based on yesterday's activity
    if (totalWeightedActivity === 0) {
      // Try to get yesterday's weighted activity as benchmark
      let estimatedDailyWeightedActivity = 1000; // Default fallback (assumes mix of activities)

      try {
        const yesterday = PSCPayoutService.getYesterdayDateString();
        const yesterdayBudget = await DynamoDBService.getBudgetByDate(
          yesterday
        );

        if (yesterdayBudget) {
          const yesterdayWeightedActivity =
            yesterdayBudget.totalViews * config.rateWeights.view +
            yesterdayBudget.totalLikes * config.rateWeights.like +
            yesterdayBudget.totalComments * config.rateWeights.comment +
            yesterdayBudget.totalBookmarks * config.rateWeights.bookmark +
            yesterdayBudget.totalProfileViews * config.rateWeights.profileView;

          // Use yesterday's weighted activity if it's reasonable (> 0), otherwise use default
          if (yesterdayWeightedActivity > 0) {
            estimatedDailyWeightedActivity = yesterdayWeightedActivity;
          }
        }
      } catch (error) {
        console.log(
          "Could not fetch yesterday's activity, using default:",
          error
        );
        // Keep default value
      }

      const baseRate = budget.remainingBudget / estimatedDailyWeightedActivity;

      // Ensure no single rate exceeds half the remaining budget
      const maxSafeRate = budget.remainingBudget / 2;

      return {
        viewRate: Math.min(
          baseRate * config.rateWeights.view,
          config.maxPayoutPerAction,
          maxSafeRate
        ),
        likeRate: Math.min(
          baseRate * config.rateWeights.like,
          config.maxPayoutPerAction,
          maxSafeRate
        ),
        commentRate: Math.min(
          baseRate * config.rateWeights.comment,
          config.maxPayoutPerAction,
          maxSafeRate
        ),
        bookmarkRate: Math.min(
          baseRate * config.rateWeights.bookmark,
          config.maxPayoutPerAction,
          maxSafeRate
        ),
        profileViewRate: Math.min(
          baseRate * config.rateWeights.profileView,
          config.maxPayoutPerAction,
          maxSafeRate
        ),
      };
    }

    // Calculate rate per weighted unit
    const ratePerWeightedUnit =
      budget.remainingBudget / (totalWeightedActivity + 100); // +100 buffer for remaining day

    // Ensure no single rate exceeds half the remaining budget
    const maxSafeRate = budget.remainingBudget / 2;

    return {
      viewRate: Math.min(
        ratePerWeightedUnit * config.rateWeights.view,
        config.maxPayoutPerAction,
        maxSafeRate
      ),
      likeRate: Math.min(
        ratePerWeightedUnit * config.rateWeights.like,
        config.maxPayoutPerAction,
        maxSafeRate
      ),
      commentRate: Math.min(
        ratePerWeightedUnit * config.rateWeights.comment,
        config.maxPayoutPerAction,
        maxSafeRate
      ),
      bookmarkRate: Math.min(
        ratePerWeightedUnit * config.rateWeights.bookmark,
        config.maxPayoutPerAction,
        maxSafeRate
      ),
      profileViewRate: Math.min(
        ratePerWeightedUnit * config.rateWeights.profileView,
        config.maxPayoutPerAction,
        maxSafeRate
      ),
    };
  }

  /**
   * Calculate payout for a specific event
   */
  static async calculatePayout(event: PayoutEvent): Promise<PayoutCalculation> {
    const config = await PSCPayoutService.getSystemConfig();

    if (!config.enableRewards) {
      return {
        amount: 0,
        rate: 0,
        eventType: event.eventType,
        budgetRemaining: 0,
        totalDailyActivity: 0,
        shouldPayout: false,
        reason: "Rewards are disabled",
      };
    }

    const budget = await PSCPayoutService.getTodaysBudget();
    const rates = await PSCPayoutService.calculateCurrentRates(budget, config);

    let rate = 0;
    switch (event.eventType) {
      case "view":
        rate = rates.viewRate;
        break;
      case "like":
        rate = rates.likeRate;
        break;
      case "comment":
        rate = rates.commentRate;
        break;
      case "bookmark":
        rate = rates.bookmarkRate;
        break;
      case "profile_view":
        rate = rates.profileViewRate;
        break;
      default:
        rate = 0;
    }

    const amount = Math.max(0, Math.min(rate, budget.remainingBudget));

    // Check if payout meets minimum requirements
    if (amount < config.minimumPayoutAmount) {
      return {
        amount: 0,
        rate,
        eventType: event.eventType,
        budgetRemaining: budget.remainingBudget,
        totalDailyActivity:
          budget.totalViews +
          budget.totalLikes +
          budget.totalComments +
          budget.totalBookmarks +
          budget.totalProfileViews,
        shouldPayout: false,
        reason: `Amount ${amount} below minimum ${config.minimumPayoutAmount}`,
      };
    }

    if (budget.remainingBudget <= 0) {
      return {
        amount: 0,
        rate,
        eventType: event.eventType,
        budgetRemaining: budget.remainingBudget,
        totalDailyActivity:
          budget.totalViews +
          budget.totalLikes +
          budget.totalComments +
          budget.totalBookmarks +
          budget.totalProfileViews,
        shouldPayout: false,
        reason: "Daily budget exhausted",
      };
    }

    return {
      amount,
      rate,
      eventType: event.eventType,
      budgetRemaining: budget.remainingBudget,
      totalDailyActivity:
        budget.totalViews +
        budget.totalLikes +
        budget.totalComments +
        budget.totalBookmarks +
        budget.totalProfileViews,
      shouldPayout: true,
    };
  }

  /**
   * Process a payout event (calculate and execute transaction)
   */
  static async processPayout(event: PayoutEvent): Promise<{
    success: boolean;
    transaction?: TransactionEntity;
    error?: string;
  }> {
    try {
      // Calculate payout
      const calculation = await PSCPayoutService.calculatePayout(event);

      if (!calculation.shouldPayout) {
        return {
          success: false,
          error: calculation.reason || "Payout not eligible",
        };
      }

      // Create transaction
      const transactionType: TransactionType =
        `reward_${event.eventType}` as TransactionType;
      const transactionId = uuidv4();

      const transaction: TransactionEntity = {
        PK: `TRANSACTION#${transactionId}`,
        SK: "METADATA",
        GSI1PK: "TRANSACTION_BY_DATE",
        GSI1SK: `${event.timestamp}#${transactionId}`,
        GSI2PK: "TRANSACTION_BY_FROM_USER",
        GSI2SK: `TREASURE#${event.timestamp}#${transactionId}`,
        GSI3PK: "TRANSACTION_BY_TO_USER",
        GSI3SK: `${event.creatorId}#${event.timestamp}#${transactionId}`,
        GSI4PK: "TRANSACTION_BY_TYPE",
        GSI4SK: `${transactionType}#${event.timestamp}#${transactionId}`,
        GSI5PK: "TRANSACTION_BY_STATUS",
        GSI5SK: `completed#${event.timestamp}#${transactionId}`,
        EntityType: "Transaction",
        transactionId,
        transactionType,
        status: "completed",
        amount: calculation.amount,
        fromUserId: "TREASURE", // Treasure-to-user transaction
        toUserId: event.creatorId,
        description: `Reward for ${event.eventType} on ${event.targetType} ${event.targetId}`,
        metadata: {
          eventType: event.eventType,
          targetType: event.targetType,
          targetId: event.targetId,
          albumId: event.metadata?.albumId,
          mediaId: event.metadata?.mediaId,
          commentId: event.metadata?.commentId,
          rate: calculation.rate,
          dailyBudget: calculation.budgetRemaining + calculation.amount,
          totalDailyActivity: calculation.totalDailyActivity,
          actionUserId: event.userId, // User who performed the action
        },
        createdAt: event.timestamp,
        completedAt: event.timestamp,
      };

      // Execute transaction (this will update user balance and budget)
      const result = await PSCTransactionService.executeTransaction(
        transaction
      );

      if (result.success) {
        // Update daily activity counters
        await PSCPayoutService.updateDailyActivity(
          event.eventType,
          calculation.amount
        );

        return {
          success: true,
          transaction: result.transaction,
        };
      } else {
        return {
          success: false,
          error: result.error || "Transaction execution failed",
        };
      }
    } catch (error) {
      console.error("Error processing payout:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update daily activity counters and budget
   */
  private static async updateDailyActivity(
    eventType: PayoutEvent["eventType"],
    amount: number
  ): Promise<void> {
    const today = PSCPayoutService.getTodayDateString();

    try {
      await DynamoDBService.updateDailyBudgetActivity(today, eventType, amount);
    } catch (error) {
      console.error("Error updating daily activity:", error);
      // Don't throw - this is not critical for transaction success
    }
  }

  /**
   * Get current payout rates for different actions
   */
  static async getCurrentRates(): Promise<DailyBudgetEntity["currentRates"]> {
    const budget = await PSCPayoutService.getTodaysBudget();
    const config = await PSCPayoutService.getSystemConfig();
    return await PSCPayoutService.calculateCurrentRates(budget, config);
  }

  /**
   * Get daily budget summary
   */
  static async getDailyBudgetSummary(): Promise<{
    total: number;
    remaining: number;
    distributed: number;
  }> {
    const budget = await PSCPayoutService.getTodaysBudget();
    return {
      total: budget.totalBudget,
      remaining: budget.remainingBudget,
      distributed: budget.distributedBudget,
    };
  }

  /**
   * Process bulk payouts for multiple events (useful for batch processing)
   */
  static async processBulkPayouts(events: PayoutEvent[]): Promise<{
    successful: TransactionEntity[];
    failed: { event: PayoutEvent; error: string }[];
  }> {
    const successful: TransactionEntity[] = [];
    const failed: { event: PayoutEvent; error: string }[] = [];

    for (const event of events) {
      const result = await PSCPayoutService.processPayout(event);
      if (result.success && result.transaction) {
        successful.push(result.transaction);
      } else {
        failed.push({
          event,
          error: result.error || "Unknown error",
        });
      }
    }

    return { successful, failed };
  }
}
