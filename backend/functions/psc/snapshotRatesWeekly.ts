/**
 * @fileoverview PSC Rate Snapshot Lambda - Weekly (1-hour intervals)
 * @description Scheduled Lambda that takes rate snapshots every hour for weekly statistics
 * @notes
 * - Triggered by EventBridge every hour at 1 minute past
 * - Creates snapshot with current rates and activity counters
 * - Used for weekly PSC rate charts and trends
 * - Also performs cleanup of old snapshots
 */

import { ScheduledEvent, Context } from "aws-lambda";
import { PSCRateSnapshotService } from "@shared/services/pscRateSnapshotService";

export const handler = async (
  event: ScheduledEvent,
  _context: Context
): Promise<{ statusCode: number; body: string }> => {
  console.log("Starting hourly PSC rate snapshot", {
    time: event.time,
    account: event.account,
    region: event.region,
  });

  try {
    // Create hourly interval snapshot
    const snapshot = await PSCRateSnapshotService.createSnapshot("1hour");

    console.log("Successfully created hourly rate snapshot", {
      date: snapshot.date,
      timestamp: snapshot.timestamp,
      rates: snapshot.rates,
      budget: snapshot.budget,
    });

    // Every 24 hours (at midnight), clean up old snapshots
    const hour = new Date().getHours();
    if (hour === 0) {
      try {
        await PSCRateSnapshotService.cleanupOldSnapshots();
        console.log("Completed cleanup of old rate snapshots");
      } catch (cleanupError) {
        console.error("Error during snapshot cleanup:", cleanupError);
        // Don't fail the main function due to cleanup issues
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Hourly rate snapshot created successfully",
        snapshot: {
          date: snapshot.date,
          timestamp: snapshot.timestamp,
          interval: snapshot.interval,
        },
        cleanupPerformed: hour === 0,
      }),
    };
  } catch (error) {
    console.error("Error creating hourly rate snapshot:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "Failed to create rate snapshot",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
