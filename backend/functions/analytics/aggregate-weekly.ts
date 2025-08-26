/*
File objective: Weekly analytics aggregation Lambda function
Scheduled execution: Every Monday at 00:10 UTC via EventBridge
Auth: Internal Lambda (no external auth required)
Purpose: Calculates and stores weekly metrics by aggregating daily data or recalculating from source
*/

import { EventBridgeEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import {
  aggregateAllMetrics,
  saveAnalyticsEntity,
  batchUpdateMetricsCache,
  queryAnalytics,
} from "@shared/utils/analytics";
import { MetricType } from "@shared/shared-types";

// Environment configuration
const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

interface DynamoDBClientConfig {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

interface S3ClientConfig {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean;
}

// DynamoDB client setup
const clientConfig: DynamoDBClientConfig = {};
if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

// S3 client setup
let s3Config: S3ClientConfig = {};
let s3Client: S3Client | null = null;

if (process.env["S3_BUCKET"]) {
  if (isLocal) {
    s3Config = {
      endpoint: "http://pornspot-local-aws:4566",
      region: process.env["AWS_REGION"] || "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
      forcePathStyle: true,
    };
  }
  s3Client = new S3Client(s3Config);
}

const METRIC_TYPES: MetricType[] = ["users", "media", "albums", "interactions"];

/**
 * Gets the start and end of a week (Monday to Sunday)
 */
function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Sunday
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Aggregates daily data into weekly metrics
 */
async function aggregateDailyToWeekly(
  metricType: MetricType,
  weekStart: Date,
  weekEnd: Date
): Promise<any> {
  const startTimeISO = weekStart.toISOString();
  const endTimeISO = weekEnd.toISOString();

  try {
    // Query all daily data for this week
    const dailyData = await queryAnalytics(
      docClient,
      metricType,
      "daily",
      startTimeISO,
      endTimeISO
    );

    if (dailyData.length === 0) {
      console.log(
        `No daily data found for ${metricType} for week ${weekStart.toDateString()} - ${weekEnd.toDateString()}, recalculating from source`
      );

      // If no daily data, calculate directly from source
      return await aggregateAllMetrics(
        docClient,
        s3Client,
        startTimeISO,
        endTimeISO
      );
    }

    console.log(
      `Found ${
        dailyData.length
      } daily records for ${metricType} for week ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
    );

    // Aggregate daily metrics into weekly totals
    const weeklyMetrics: any = {};

    // For weekly metrics, we want:
    // - Latest totals (from most recent day)
    // - Sum of all new items across the week
    // - Max active users across all days
    // - Average values where applicable

    const latestDay = dailyData[0]; // Most recent (sorted DESC)

    if (latestDay?.metrics) {
      // Total counts - take the latest value (end of week totals)
      weeklyMetrics.totalUsers = latestDay.metrics.totalUsers;
      weeklyMetrics.totalMedia = latestDay.metrics.totalMedia;
      weeklyMetrics.totalAlbums = latestDay.metrics.totalAlbums;
      weeklyMetrics.publicMedia = latestDay.metrics.publicMedia;
      weeklyMetrics.privateMedia = latestDay.metrics.privateMedia;
      weeklyMetrics.publicAlbums = latestDay.metrics.publicAlbums;
      weeklyMetrics.privateAlbums = latestDay.metrics.privateAlbums;

      // New items - sum all daily increments across the week
      weeklyMetrics.newUsers = dailyData.reduce(
        (sum, day) => sum + (day.metrics.newUsers || 0),
        0
      );
      weeklyMetrics.newMedia = dailyData.reduce(
        (sum, day) => sum + (day.metrics.newMedia || 0),
        0
      );
      weeklyMetrics.newAlbums = dailyData.reduce(
        (sum, day) => sum + (day.metrics.newAlbums || 0),
        0
      );
      weeklyMetrics.newLikes = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newLikes"] || 0),
        0
      );
      weeklyMetrics.newBookmarks = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newBookmarks"] || 0),
        0
      );
      weeklyMetrics.newComments = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newComments"] || 0),
        0
      );
      weeklyMetrics.newViews = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newViews"] || 0),
        0
      );

      // Active users - take max value across all days of the week
      weeklyMetrics.activeUsers = Math.max(
        ...dailyData.map((day) => day.metrics.activeUsers || 0)
      );

      // Calculate weekly averages for key metrics
      const validDays = dailyData.length;
      weeklyMetrics.avgNewUsersPerDay = Math.round(
        (weeklyMetrics.newUsers || 0) / validDays
      );
      weeklyMetrics.avgNewMediaPerDay = Math.round(
        (weeklyMetrics.newMedia || 0) / validDays
      );
      weeklyMetrics.avgActiveUsersPerDay = Math.round(
        dailyData.reduce(
          (sum, day) => sum + (day.metrics.activeUsers || 0),
          0
        ) / validDays
      );

      // Storage - take latest values
      weeklyMetrics.totalStorageBytes = latestDay.metrics["totalStorageBytes"];
      weeklyMetrics.totalStorageGB = latestDay.metrics["totalStorageGB"];

      // Add week metadata
      weeklyMetrics.weekStart = weekStart.toISOString();
      weeklyMetrics.weekEnd = weekEnd.toISOString();
      weeklyMetrics.daysIncluded = validDays;
    }

    return weeklyMetrics;
  } catch (error) {
    console.error(
      `Error aggregating daily to weekly for ${metricType}:`,
      error
    );
    throw error;
  }
}

/**
 * Processes weekly analytics for a specific week
 */
async function processWeeklyMetrics(
  weekStart: Date,
  weekEnd: Date
): Promise<void> {
  console.log(
    `Processing weekly metrics for ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
  );

  const startTimeISO = weekStart.toISOString();
  const endTimeISO = weekEnd.toISOString();

  try {
    // Process each metric type
    const savePromises = METRIC_TYPES.map(async (metricType) => {
      const weeklyMetrics = await aggregateDailyToWeekly(
        metricType,
        weekStart,
        weekEnd
      );

      await saveAnalyticsEntity(
        docClient,
        metricType,
        "weekly",
        startTimeISO,
        endTimeISO,
        weeklyMetrics
      );
    });

    await Promise.all(savePromises);

    // Update cache with weekly summaries (if this is for last week)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekRange = getWeekRange(lastWeek);

    if (weekStart.toDateString() === lastWeekRange.start.toDateString()) {
      // Get the aggregated weekly metrics for cache
      const weeklyMetrics = await aggregateDailyToWeekly(
        "users",
        weekStart,
        weekEnd
      );

      const cacheUpdates = [
        {
          key: "new_users_last_week",
          value: weeklyMetrics.newUsers || 0,
          ttl: 604800,
        },
        {
          key: "new_media_last_week",
          value: weeklyMetrics.newMedia || 0,
          ttl: 604800,
        },
        {
          key: "new_albums_last_week",
          value: weeklyMetrics.newAlbums || 0,
          ttl: 604800,
        },
        {
          key: "avg_new_users_per_day",
          value: weeklyMetrics.avgNewUsersPerDay || 0,
          ttl: 604800,
        },
        {
          key: "avg_active_users_per_day",
          value: weeklyMetrics.avgActiveUsersPerDay || 0,
          ttl: 604800,
        },
        {
          key: "weekly_last_updated",
          value: new Date().toISOString(),
          ttl: 604800,
        },
      ];

      await batchUpdateMetricsCache(docClient, cacheUpdates);
    }

    console.log(
      `✅ Successfully processed weekly metrics for ${weekStart.toDateString()} - ${weekEnd.toDateString()}`
    );
  } catch (error) {
    console.error(
      `❌ Error processing weekly metrics for ${weekStart.toDateString()} - ${weekEnd.toDateString()}:`,
      error
    );
    throw error;
  }
}

/**
 * Main Lambda handler for weekly analytics aggregation
 */
export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<void> {
  console.log("📅 Starting weekly analytics aggregation", {
    event: event.detail,
    time: new Date().toISOString(),
  });

  try {
    // Process metrics for the previous week (Monday to Sunday)
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);

    const { start: weekStart, end: weekEnd } = getWeekRange(lastWeek);

    await processWeeklyMetrics(weekStart, weekEnd);

    console.log("✅ Weekly analytics aggregation completed successfully");
  } catch (error) {
    console.error("❌ Fatal error in weekly analytics aggregation:", error);

    // Re-throw to mark Lambda as failed for monitoring/alerting
    throw new Error(`Weekly analytics aggregation failed: ${error}`);
  }
}

/**
 * Manual backfill function for weekly metrics
 */
export async function backfillHandler(event: {
  backfill: boolean;
  startDate: string;
  endDate: string;
}): Promise<void> {
  if (!event.backfill) {
    throw new Error("This function requires backfill flag to be true");
  }

  console.log("🔄 Starting weekly analytics backfill", {
    startDate: event.startDate,
    endDate: event.endDate,
  });

  const startTime = new Date(event.startDate);
  const endTime = new Date(event.endDate);

  if (startTime >= endTime) {
    throw new Error("startDate must be before endDate");
  }

  // Generate all weeks in the range
  const weeks = [];
  const current = new Date(startTime);

  while (current < endTime) {
    const weekRange = getWeekRange(current);
    if (weekRange.end <= endTime) {
      weeks.push(weekRange);
    }
    current.setDate(current.getDate() + 7); // Next week
  }

  console.log(`Processing ${weeks.length} weeks for backfill`);

  // Process weeks sequentially
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    if (week) {
      console.log(
        `Processing week ${i + 1}/${
          weeks.length
        }: ${week.start.toDateString()} - ${week.end.toDateString()}`
      );
      await processWeeklyMetrics(week.start, week.end);

      // Brief pause between weeks
      if (i < weeks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  console.log("✅ Weekly analytics backfill completed successfully");
}

// Export both handlers
export { handler as default };
