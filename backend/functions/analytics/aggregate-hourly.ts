/*
File objective: Hourly analytics aggregation Lambda function
Scheduled execution: Every hour via EventBridge
Auth: Internal Lambda (no external auth required)
Purpose: Calculates and stores hourly metrics for all metric types
*/

import { EventBridgeEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import {
  aggregateAllMetrics,
  saveAnalyticsEntity,
  batchUpdateMetricsCache,
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
 * Processes hourly analytics for a specific hour
 */
async function processHourlyMetrics(targetHour: Date): Promise<void> {
  console.log(`Processing hourly metrics for ${targetHour.toISOString()}`);

  // Calculate time range for the target hour
  const startTime = new Date(targetHour);
  startTime.setMinutes(0, 0, 0);

  const endTime = new Date(targetHour);
  endTime.setMinutes(59, 59, 999);

  const startTimeISO = startTime.toISOString();
  const endTimeISO = endTime.toISOString();

  try {
    // Aggregate all metrics for this hour
    const aggregatedMetrics = await aggregateAllMetrics(
      docClient,
      s3Client,
      startTimeISO,
      endTimeISO
    );

    console.log(
      `Aggregated metrics:`,
      JSON.stringify(aggregatedMetrics, null, 2)
    );

    // Save individual metric types
    const savePromises = METRIC_TYPES.map((metricType) =>
      saveAnalyticsEntity(
        docClient,
        metricType,
        "hourly",
        startTimeISO,
        endTimeISO,
        aggregatedMetrics
      )
    );

    await Promise.all(savePromises);

    // Update real-time cache with latest totals
    const cacheUpdates = [
      {
        key: "total_users",
        value: aggregatedMetrics.totalUsers || 0,
        ttl: 3600,
      },
      {
        key: "total_media",
        value: aggregatedMetrics.totalMedia || 0,
        ttl: 3600,
      },
      {
        key: "total_albums",
        value: aggregatedMetrics.totalAlbums || 0,
        ttl: 3600,
      },
      {
        key: "new_users_last_hour",
        value: aggregatedMetrics.newUsers || 0,
        ttl: 3600,
      },
      {
        key: "new_media_last_hour",
        value: aggregatedMetrics.newMedia || 0,
        ttl: 3600,
      },
      {
        key: "new_albums_last_hour",
        value: aggregatedMetrics.newAlbums || 0,
        ttl: 3600,
      },
      { key: "last_updated", value: new Date().toISOString(), ttl: 3600 },
    ];

    await batchUpdateMetricsCache(docClient, cacheUpdates);

    console.log(`✅ Successfully processed hourly metrics for ${startTimeISO}`);
  } catch (error) {
    console.error(
      `❌ Error processing hourly metrics for ${startTimeISO}:`,
      error
    );
    throw error;
  }
}

/**
 * Main Lambda handler for hourly analytics aggregation
 */
export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<void> {
  console.log("🕐 Starting hourly analytics aggregation", {
    event: event.detail,
    time: new Date().toISOString(),
  });

  try {
    // Process metrics for the previous hour
    const now = new Date();
    const targetHour = new Date(now);
    targetHour.setHours(now.getHours() - 1); // Previous hour

    await processHourlyMetrics(targetHour);

    console.log("✅ Hourly analytics aggregation completed successfully");
  } catch (error) {
    console.error("❌ Fatal error in hourly analytics aggregation:", error);

    // Re-throw to mark Lambda as failed for monitoring/alerting
    throw new Error(`Hourly analytics aggregation failed: ${error}`);
  }
}

/**
 * Manual backfill function - can be invoked directly for testing or backfilling
 * Usage: Invoke Lambda directly with { backfill: true, startHour: "2023-12-01T10:00:00.000Z", endHour: "2023-12-01T15:00:00.000Z" }
 */
export async function backfillHandler(event: {
  backfill: boolean;
  startHour: string;
  endHour: string;
}): Promise<void> {
  if (!event.backfill) {
    throw new Error("This function requires backfill flag to be true");
  }

  console.log("🔄 Starting hourly analytics backfill", {
    startHour: event.startHour,
    endHour: event.endHour,
  });

  const startTime = new Date(event.startHour);
  const endTime = new Date(event.endHour);

  if (startTime >= endTime) {
    throw new Error("startHour must be before endHour");
  }

  const hours = [];
  const current = new Date(startTime);

  while (current < endTime) {
    hours.push(new Date(current));
    current.setHours(current.getHours() + 1);
  }

  console.log(`Processing ${hours.length} hours for backfill`);

  // Process hours in batches to avoid timeout
  const BATCH_SIZE = 6; // Process 6 hours at a time

  for (let i = 0; i < hours.length; i += BATCH_SIZE) {
    const batch = hours.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        hours.length / BATCH_SIZE
      )}`
    );

    const batchPromises = batch.map((hour) => processHourlyMetrics(hour));
    await Promise.all(batchPromises);

    // Brief pause between batches to avoid throttling
    if (i + BATCH_SIZE < hours.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("✅ Hourly analytics backfill completed successfully");
}

// Export both handlers - EventBridge will use the default handler
export { handler as default };
