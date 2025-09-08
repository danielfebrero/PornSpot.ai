/**
 * @fileoverview PSC Rate Snapshot Service
 * @description Service for creating and retrieving PSC rate snapshots at regular intervals
 * @notes
 * - Takes snapshots every 5 minutes for daily stats
 * - Takes snapshots every hour for weekly stats
 * - Stores historical rate data for user statistics
 * - Provides data for PSC rate charts and trends
 */

import { DynamoDBService } from "../utils/dynamodb";
import { PSCPayoutService } from "../utils/psc-payout";
import { RateSnapshotEntity } from "@shared/shared-types";

export class PSCRateSnapshotService {
  /**
   * Create a rate snapshot for the specified interval
   */
  static async createSnapshot(
    interval: "5min" | "1hour"
  ): Promise<RateSnapshotEntity> {
    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split("T")[0];

    // Get current budget and config
    const budget = await PSCPayoutService.getTodaysBudget();
    const config = await PSCPayoutService.getSystemConfig();

    // Calculate current rates
    const currentRates = await PSCPayoutService.calculateCurrentRates(
      budget,
      config
    );

    // Create snapshot entity
    const snapshot: RateSnapshotEntity = {
      PK: `PSC_RATE_SNAPSHOT#${date}`,
      SK: `${timestamp}#${interval}`,
      GSI1PK: "PSC_RATE_SNAPSHOT",
      GSI1SK: `${date}#${interval}#${timestamp}`,
      EntityType: "RateSnapshot",

      date: date!,
      timestamp,
      interval,

      rates: currentRates,

      budget: {
        total: budget.totalBudget,
        remaining: budget.remainingBudget,
        distributed: budget.distributedBudget,
      },

      activity: {
        totalViews: budget.totalViews,
        totalLikes: budget.totalLikes,
        totalComments: budget.totalComments,
        totalBookmarks: budget.totalBookmarks,
        totalProfileViews: budget.totalProfileViews,
      },

      createdAt: timestamp,
    };

    // Save to DynamoDB
    await DynamoDBService.saveRateSnapshot(snapshot);

    console.log(
      `Created ${interval} rate snapshot for ${date} at ${timestamp}`
    );
    return snapshot;
  }

  /**
   * Get rate snapshots for a specific date and interval
   */
  static async getSnapshotsForDate(
    date: string,
    interval: "5min" | "1hour"
  ): Promise<RateSnapshotEntity[]> {
    return await DynamoDBService.getRateSnapshotsByDate(date, interval);
  }

  /**
   * Get rate snapshots for a date range
   */
  static async getSnapshotsForDateRange(
    startDate: string,
    endDate: string,
    interval: "5min" | "1hour"
  ): Promise<RateSnapshotEntity[]> {
    const snapshots: RateSnapshotEntity[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split("T")[0];
      if (!dateStr) throw new Error("Invalid date string");

      const dailySnapshots = await this.getSnapshotsForDate(dateStr, interval);
      snapshots.push(...dailySnapshots);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get daily snapshots (5-minute intervals) for the last 24 hours
   */
  static async getDailySnapshots(): Promise<RateSnapshotEntity[]> {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (!today || !yesterdayStr) {
      throw new Error("Invalid date strings");
    }

    // Get snapshots from yesterday and today to cover last 24 hours
    const [yesterdaySnapshots, todaySnapshots] = await Promise.all([
      this.getSnapshotsForDate(yesterdayStr, "5min"),
      this.getSnapshotsForDate(today, "5min"),
    ]);

    const allSnapshots = [...yesterdaySnapshots, ...todaySnapshots];

    // Filter to last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return allSnapshots
      .filter((snapshot) => new Date(snapshot.timestamp) >= twentyFourHoursAgo)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get weekly snapshots (hourly intervals) for the last 7 days
   */
  static async getWeeklySnapshots(): Promise<RateSnapshotEntity[]> {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const startDate = sevenDaysAgo.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    if (!startDate || !endDate) {
      throw new Error("Invalid date strings");
    }

    return await this.getSnapshotsForDateRange(startDate, endDate, "1hour");
  }

  /**
   * Clean up old snapshots (older than 30 days)
   */
  static async cleanupOldSnapshots(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    if (!cutoffDate) {
      throw new Error("Invalid cutoff date");
    }

    await DynamoDBService.deleteOldRateSnapshots(cutoffDate);
    console.log(`Cleaned up rate snapshots older than ${cutoffDate}`);
  }
}
