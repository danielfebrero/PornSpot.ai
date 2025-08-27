/*
File objective: Monthly analytics aggregation Lambda function
Scheduled execution: 1st of each month at 00:15 UTC via EventBridge
Auth: Internal Lambda (no external auth required)
Purpose: Calculates and stores monthly metrics by aggregating daily data or recalculating from source
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
const s3Client = new S3Client(s3Config);

const METRIC_TYPES: MetricType[] = [
  "users",
  "media",
  "albums",
  "interactions",
  "generations",
  "storage",
];
/**
 * Gets the start and end of a month
 */
function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Aggregates daily data into monthly metrics
 */
async function aggregateDailyToMonthly(
  metricType: MetricType,
  monthStart: Date,
  monthEnd: Date
): Promise<any> {
  const startTimeISO = monthStart.toISOString();
  const endTimeISO = monthEnd.toISOString();

  try {
    // Query all daily data for this month
    const dailyData = await queryAnalytics(
      docClient,
      metricType,
      "daily",
      startTimeISO,
      endTimeISO
    );

    if (dailyData.length === 0) {
      console.log(
        `No daily data found for ${metricType} for ${monthStart.toLocaleDateString(
          "en-US",
          { month: "long", year: "numeric" }
        )}, recalculating from source`
      );

      // If no daily data, calculate directly from source
      return await aggregateAllMetrics(
        docClient,
        s3Client,
        startTimeISO,
        endTimeISO
      );
    }

    const monthName = monthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    console.log(
      `Found ${dailyData.length} daily records for ${metricType} for ${monthName}`
    );

    // Aggregate daily metrics into monthly totals
    const monthlyMetrics: any = {};

    // For monthly metrics, we want:
    // - Latest totals (from most recent day)
    // - Sum of all new items across the month
    // - Max active users across all days
    // - Average values and growth rates

    const latestDay = dailyData[0]; // Most recent (sorted DESC)
    const firstDay = dailyData[dailyData.length - 1]; // Oldest day

    if (latestDay?.metrics) {
      // Total counts - take the latest value (end of month totals)
      monthlyMetrics.totalUsers = latestDay.metrics.totalUsers;
      monthlyMetrics.totalMedia = latestDay.metrics.totalMedia;
      monthlyMetrics.totalAlbums = latestDay.metrics.totalAlbums;
      monthlyMetrics.publicMedia = latestDay.metrics.publicMedia;
      monthlyMetrics.privateMedia = latestDay.metrics.privateMedia;
      monthlyMetrics.publicAlbums = latestDay.metrics.publicAlbums;
      monthlyMetrics.privateAlbums = latestDay.metrics.privateAlbums;

      // New items - sum all daily increments across the month
      monthlyMetrics.newUsers = dailyData.reduce(
        (sum, day) => sum + (day.metrics.newUsers || 0),
        0
      );
      monthlyMetrics.newMedia = dailyData.reduce(
        (sum, day) => sum + (day.metrics.newMedia || 0),
        0
      );
      monthlyMetrics.newAlbums = dailyData.reduce(
        (sum, day) => sum + (day.metrics.newAlbums || 0),
        0
      );
      monthlyMetrics.newLikes = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newLikes"] || 0),
        0
      );
      monthlyMetrics.newBookmarks = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newBookmarks"] || 0),
        0
      );
      monthlyMetrics.newComments = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newComments"] || 0),
        0
      );
      monthlyMetrics.newViews = dailyData.reduce(
        (sum, day) => sum + (day.metrics["newViews"] || 0),
        0
      );

      // Active users - take max value across all days of the month
      monthlyMetrics.activeUsers = Math.max(
        ...dailyData.map((day) => day.metrics.activeUsers || 0)
      );

      // Calculate monthly averages and growth metrics
      const validDays = dailyData.length;
      monthlyMetrics.avgNewUsersPerDay = Math.round(
        (monthlyMetrics.newUsers || 0) / validDays
      );
      monthlyMetrics.avgNewMediaPerDay = Math.round(
        (monthlyMetrics.newMedia || 0) / validDays
      );
      monthlyMetrics.avgActiveUsersPerDay = Math.round(
        dailyData.reduce(
          (sum, day) => sum + (day.metrics.activeUsers || 0),
          0
        ) / validDays
      );

      // Growth rates (compare end of month vs beginning)
      if (firstDay?.metrics) {
        const userGrowth =
          (latestDay.metrics.totalUsers || 0) -
          (firstDay.metrics.totalUsers || 0);
        const mediaGrowth =
          (latestDay.metrics.totalMedia || 0) -
          (firstDay.metrics.totalMedia || 0);
        const albumGrowth =
          (latestDay.metrics.totalAlbums || 0) -
          (firstDay.metrics.totalAlbums || 0);

        monthlyMetrics.userGrowthCount = userGrowth;
        monthlyMetrics.mediaGrowthCount = mediaGrowth;
        monthlyMetrics.albumGrowthCount = albumGrowth;

        // Growth percentages
        if (firstDay.metrics.totalUsers && firstDay.metrics.totalUsers > 0) {
          monthlyMetrics.userGrowthPercent = Number(
            ((userGrowth / firstDay.metrics.totalUsers) * 100).toFixed(2)
          );
        }
        if (firstDay.metrics.totalMedia && firstDay.metrics.totalMedia > 0) {
          monthlyMetrics.mediaGrowthPercent = Number(
            ((mediaGrowth / firstDay.metrics.totalMedia) * 100).toFixed(2)
          );
        }
        if (firstDay.metrics.totalAlbums && firstDay.metrics.totalAlbums > 0) {
          monthlyMetrics.albumGrowthPercent = Number(
            ((albumGrowth / firstDay.metrics.totalAlbums) * 100).toFixed(2)
          );
        }
      }

      // Find peak activity days
      const peakActiveUsers = Math.max(
        ...dailyData.map((day) => day.metrics.activeUsers || 0)
      );
      const peakNewUsers = Math.max(
        ...dailyData.map((day) => day.metrics.newUsers || 0)
      );
      const peakNewMedia = Math.max(
        ...dailyData.map((day) => day.metrics.newMedia || 0)
      );

      monthlyMetrics.peakActiveUsers = peakActiveUsers;
      monthlyMetrics.peakNewUsersInDay = peakNewUsers;
      monthlyMetrics.peakNewMediaInDay = peakNewMedia;

      // Storage - take latest values
      monthlyMetrics.totalStorageBytes = latestDay.metrics["totalStorageBytes"];
      monthlyMetrics.totalStorageGB = latestDay.metrics["totalStorageGB"];

      // Add month metadata
      monthlyMetrics.monthStart = monthStart.toISOString();
      monthlyMetrics.monthEnd = monthEnd.toISOString();
      monthlyMetrics.daysIncluded = validDays;
      monthlyMetrics.monthName = monthName;

      // Calculate retention-like metrics
      const totalDaysInMonth = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0
      ).getDate();
      monthlyMetrics.dataCompleteness = Number(
        ((validDays / totalDaysInMonth) * 100).toFixed(1)
      );
    }

    return monthlyMetrics;
  } catch (error) {
    console.error(
      `Error aggregating daily to monthly for ${metricType}:`,
      error
    );
    throw error;
  }
}

/**
 * Processes monthly analytics for a specific month
 */
async function processMonthlyMetrics(
  monthStart: Date,
  monthEnd: Date
): Promise<void> {
  const monthName = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  console.log(`Processing monthly metrics for ${monthName}`);

  const startTimeISO = monthStart.toISOString();
  const endTimeISO = monthEnd.toISOString();

  try {
    // Process each metric type
    const savePromises = METRIC_TYPES.map(async (metricType) => {
      const monthlyMetrics = await aggregateDailyToMonthly(
        metricType,
        monthStart,
        monthEnd
      );

      await saveAnalyticsEntity(
        docClient,
        metricType,
        "monthly",
        startTimeISO,
        endTimeISO,
        monthlyMetrics
      );
    });

    await Promise.all(savePromises);

    // Update cache with monthly summaries (if this is for last month)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthRange = getMonthRange(lastMonth);

    if (monthStart.getTime() === lastMonthRange.start.getTime()) {
      // Get the aggregated monthly metrics for cache
      const monthlyMetrics = await aggregateDailyToMonthly(
        "users",
        monthStart,
        monthEnd
      );

      const cacheUpdates = [
        {
          key: "new_users_last_month",
          value: monthlyMetrics.newUsers || 0,
          ttl: 2592000,
        },
        {
          key: "new_media_last_month",
          value: monthlyMetrics.newMedia || 0,
          ttl: 2592000,
        },
        {
          key: "new_albums_last_month",
          value: monthlyMetrics.newAlbums || 0,
          ttl: 2592000,
        },
        {
          key: "user_growth_percent",
          value: monthlyMetrics.userGrowthPercent || 0,
          ttl: 2592000,
        },
        {
          key: "media_growth_percent",
          value: monthlyMetrics.mediaGrowthPercent || 0,
          ttl: 2592000,
        },
        {
          key: "peak_active_users",
          value: monthlyMetrics.peakActiveUsers || 0,
          ttl: 2592000,
        },
        {
          key: "avg_new_users_per_day",
          value: monthlyMetrics.avgNewUsersPerDay || 0,
          ttl: 2592000,
        },
        {
          key: "monthly_last_updated",
          value: new Date().toISOString(),
          ttl: 2592000,
        },
      ];

      await batchUpdateMetricsCache(docClient, cacheUpdates);
    }

    console.log(`✅ Successfully processed monthly metrics for ${monthName}`);
  } catch (error) {
    console.error(
      `❌ Error processing monthly metrics for ${monthName}:`,
      error
    );
    throw error;
  }
}

/**
 * Main Lambda handler for monthly analytics aggregation
 */
export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<void> {
  console.log("📅 Starting monthly analytics aggregation", {
    event: event.detail,
    time: new Date().toISOString(),
  });

  try {
    // Process metrics for the previous month
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);

    const { start: monthStart, end: monthEnd } = getMonthRange(lastMonth);

    await processMonthlyMetrics(monthStart, monthEnd);

    console.log("✅ Monthly analytics aggregation completed successfully");
  } catch (error) {
    console.error("❌ Fatal error in monthly analytics aggregation:", error);

    // Re-throw to mark Lambda as failed for monitoring/alerting
    throw new Error(`Monthly analytics aggregation failed: ${error}`);
  }
}

/**
 * Manual backfill function for monthly metrics
 */
export async function backfillHandler(event: {
  backfill: boolean;
  startDate: string;
  endDate: string;
}): Promise<void> {
  if (!event.backfill) {
    throw new Error("This function requires backfill flag to be true");
  }

  console.log("🔄 Starting monthly analytics backfill", {
    startDate: event.startDate,
    endDate: event.endDate,
  });

  const startTime = new Date(event.startDate);
  const endTime = new Date(event.endDate);

  if (startTime >= endTime) {
    throw new Error("startDate must be before endDate");
  }

  // Generate all months in the range
  const months = [];
  const current = new Date(startTime.getFullYear(), startTime.getMonth(), 1);

  while (current < endTime) {
    const monthRange = getMonthRange(current);
    if (monthRange.end <= endTime) {
      months.push(monthRange);
    }
    current.setMonth(current.getMonth() + 1); // Next month
  }

  console.log(`Processing ${months.length} months for backfill`);

  // Process months sequentially
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    if (month) {
      const monthName = month.start.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      console.log(`Processing month ${i + 1}/${months.length}: ${monthName}`);
      await processMonthlyMetrics(month.start, month.end);

      // Brief pause between months
      if (i < months.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  console.log("✅ Monthly analytics backfill completed successfully");
}

// Export both handlers
export { handler as default };
