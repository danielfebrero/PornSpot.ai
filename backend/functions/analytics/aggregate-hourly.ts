/**
 * @fileoverview Hourly Analytics Aggregation Handler
 * @description Scheduled Lambda function that calculates and stores hourly metrics for all types by querying source data.
 * @event EventBridgeEvent - Scheduled every hour.
 * @auth Internal (no external auth).
 * @notes
 * - Aggregates directly from source data for the previous hour.
 * - Processes all metric types: users, media, albums, interactions, generations, storage.
 * - Stores in DynamoDB with hourly granularity.
 * - LocalStack config for development.
 * - Logs metrics; re-throws errors for alerting.
 * - Commented cache update logic.
 */

import { EventBridgeEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import {
  aggregateAllMetrics,
  saveAnalyticsEntity,
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
  "business",
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

// Export both handlers - EventBridge will use the default handler
export { handler as default };
