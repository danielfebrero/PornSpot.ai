/**
 * @fileoverview PSC Rate Snapshot Lambda - Daily (5-minute intervals)
 * @description Scheduled Lambda that takes rate snapshots every 5 minutes for daily statistics
 * @notes
 * - Triggered by EventBridge every 5 minutes
 * - Creates snapshot with current rates and activity counters
 * - Used for daily PSC rate charts and trends
 * - Optimized for minimal execution time and cost
 */

import { ScheduledEvent, Context } from "aws-lambda";
import { PSCRateSnapshotService } from "@shared/services/pscRateSnapshotService";

export const handler = async (
  event: ScheduledEvent,
  _context: Context
): Promise<{ statusCode: number; body: string }> => {
  console.log("Starting 5-minute PSC rate snapshot", {
    time: event.time,
    account: event.account,
    region: event.region,
  });

  try {
    // Create 5-minute interval snapshot
    const snapshot = await PSCRateSnapshotService.createSnapshot("5min");

    console.log("Successfully created 5-minute rate snapshot", {
      date: snapshot.date,
      timestamp: snapshot.timestamp,
      rates: snapshot.rates,
      budget: snapshot.budget,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "5-minute rate snapshot created successfully",
        snapshot: {
          date: snapshot.date,
          timestamp: snapshot.timestamp,
          interval: snapshot.interval,
        },
      }),
    };
  } catch (error) {
    console.error("Error creating 5-minute rate snapshot:", error);

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
