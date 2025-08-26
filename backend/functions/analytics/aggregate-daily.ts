/*
File objective: Daily analytics aggregation Lambda function
Scheduled execution: Once per day at 00:05 UTC via EventBridge
Auth: Internal Lambda (no external auth required)
Purpose: Calculates and stores daily metrics by aggregating hourly data or recalculating from source
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

const METRIC_TYPES: MetricType[] = [
  "users",
  "media",
  "albums",
  "interactions",
  "generations",
  "storage",
];
/**
 * Aggregates hourly data into daily metrics
 */
async function aggregateHourlyToDaily(
  metricType: MetricType,
  targetDate: Date
): Promise<any> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startTimeISO = startOfDay.toISOString();
  const endTimeISO = endOfDay.toISOString();

  try {
    // Query all hourly data for this day
    const hourlyData = await queryAnalytics(
      docClient,
      metricType,
      "hourly",
      startTimeISO,
      endTimeISO
    );

    if (hourlyData.length === 0) {
      console.log(
        `No hourly data found for ${metricType} on ${targetDate.toDateString()}, recalculating from source`
      );

      // If no hourly data, calculate directly from source
      return await aggregateAllMetrics(
        docClient,
        s3Client,
        startTimeISO,
        endTimeISO
      );
    }

    console.log(
      `Found ${
        hourlyData.length
      } hourly records for ${metricType} on ${targetDate.toDateString()}`
    );

    // Aggregate hourly metrics into daily totals
    const dailyMetrics: any = {};

    // For each metric type, we'll aggregate differently
    // Total metrics: take the latest value (most recent hourly total)
    // New/increment metrics: sum all hourly values
    // Average metrics: calculate weighted average

    const latestHour = hourlyData[0]; // Most recent (sorted DESC)

    if (latestHour?.metrics) {
      // Total counts - take the latest value
      dailyMetrics.totalUsers = latestHour.metrics.totalUsers;
      dailyMetrics.totalMedia = latestHour.metrics.totalMedia;
      dailyMetrics.totalAlbums = latestHour.metrics.totalAlbums;
      dailyMetrics.publicMedia = latestHour.metrics.publicMedia;
      dailyMetrics.privateMedia = latestHour.metrics.privateMedia;
      dailyMetrics.publicAlbums = latestHour.metrics.publicAlbums;
      dailyMetrics.privateAlbums = latestHour.metrics.privateAlbums;

      // New items - sum all hourly increments
      dailyMetrics.newUsers = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics.newUsers || 0),
        0
      );
      dailyMetrics.newMedia = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics.newMedia || 0),
        0
      );
      dailyMetrics.newAlbums = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics.newAlbums || 0),
        0
      );
      dailyMetrics.newLikes = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics["newLikes"] || 0),
        0
      );
      dailyMetrics.newBookmarks = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics["newBookmarks"] || 0),
        0
      );
      dailyMetrics.newComments = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics["newComments"] || 0),
        0
      );
      dailyMetrics.newViews = hourlyData.reduce(
        (sum, hour) => sum + (hour.metrics["newViews"] || 0),
        0
      );

      // Active users - take max value across all hours
      dailyMetrics.activeUsers = Math.max(
        ...hourlyData.map((hour) => hour.metrics.activeUsers || 0)
      );

      // Storage - take latest values
      dailyMetrics.totalStorageBytes = latestHour.metrics["totalStorageBytes"];
      dailyMetrics.totalStorageGB = latestHour.metrics["totalStorageGB"];
    }

    return dailyMetrics;
  } catch (error) {
    console.error(
      `Error aggregating hourly to daily for ${metricType}:`,
      error
    );
    throw error;
  }
}

/**
 * Processes daily analytics for a specific date
 */
async function processDailyMetrics(targetDate: Date): Promise<void> {
  console.log(`Processing daily metrics for ${targetDate.toDateString()}`);

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startTimeISO = startOfDay.toISOString();
  const endTimeISO = endOfDay.toISOString();

  try {
    // Process each metric type
    const savePromises = METRIC_TYPES.map(async (metricType) => {
      const dailyMetrics = await aggregateHourlyToDaily(metricType, targetDate);

      await saveAnalyticsEntity(
        docClient,
        metricType,
        "daily",
        startTimeISO,
        endTimeISO,
        dailyMetrics
      );
    });

    await Promise.all(savePromises);

    // Update cache with daily summaries (if this is for yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    if (targetDate.toDateString() === yesterday.toDateString()) {
      // Get the aggregated daily metrics for cache
      const dailyMetrics = await aggregateHourlyToDaily("users", targetDate);

      const cacheUpdates = [
        {
          key: "new_users_yesterday",
          value: dailyMetrics.newUsers || 0,
          ttl: 86400,
        },
        {
          key: "new_media_yesterday",
          value: dailyMetrics.newMedia || 0,
          ttl: 86400,
        },
        {
          key: "new_albums_yesterday",
          value: dailyMetrics.newAlbums || 0,
          ttl: 86400,
        },
        {
          key: "active_users_yesterday",
          value: dailyMetrics.activeUsers || 0,
          ttl: 86400,
        },
        {
          key: "daily_last_updated",
          value: new Date().toISOString(),
          ttl: 86400,
        },
      ];

      await batchUpdateMetricsCache(docClient, cacheUpdates);
    }

    console.log(
      `✅ Successfully processed daily metrics for ${targetDate.toDateString()}`
    );
  } catch (error) {
    console.error(
      `❌ Error processing daily metrics for ${targetDate.toDateString()}:`,
      error
    );
    throw error;
  }
}

/**
 * Main Lambda handler for daily analytics aggregation
 */
export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<void> {
  console.log("📅 Starting daily analytics aggregation", {
    event: event.detail,
    time: new Date().toISOString(),
  });

  try {
    // Process metrics for yesterday (completed day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await processDailyMetrics(yesterday);

    console.log("✅ Daily analytics aggregation completed successfully");
  } catch (error) {
    console.error("❌ Fatal error in daily analytics aggregation:", error);

    // Re-throw to mark Lambda as failed for monitoring/alerting
    throw new Error(`Daily analytics aggregation failed: ${error}`);
  }
}

/**
 * Manual backfill function for daily metrics
 */
export async function backfillHandler(event: {
  backfill: boolean;
  startDate: string;
  endDate: string;
}): Promise<void> {
  if (!event.backfill) {
    throw new Error("This function requires backfill flag to be true");
  }

  console.log("🔄 Starting daily analytics backfill", {
    startDate: event.startDate,
    endDate: event.endDate,
  });

  const startTime = new Date(event.startDate);
  const endTime = new Date(event.endDate);

  if (startTime >= endTime) {
    throw new Error("startDate must be before endDate");
  }

  const days = [];
  const current = new Date(startTime);

  while (current < endTime) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  console.log(`Processing ${days.length} days for backfill`);

  // Process days sequentially to avoid overwhelming the system
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day) {
      console.log(
        `Processing day ${i + 1}/${days.length}: ${day.toDateString()}`
      );
      await processDailyMetrics(day);

      // Brief pause between days
      if (i < days.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  console.log("✅ Daily analytics backfill completed successfully");
}

// Export both handlers
export { handler as default };
