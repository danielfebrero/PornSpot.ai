import {
  QueryCommand,
  PutCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  AnalyticsMetrics,
  MetricGranularity,
  MetricType,
  AnalyticsEntity,
  MetricsCacheEntity,
} from "@shared/shared-types";

// Get DynamoDB client from environment
const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;
const S3_BUCKET = process.env["S3_BUCKET"];

/**
 * Mapping of metric types to their relevant metric fields
 */
const METRIC_TYPE_MAPPING: Record<MetricType, (keyof AnalyticsMetrics)[]> = {
  users: ["totalUsers", "newUsers", "activeUsers", "deletedUsers"],
  media: [
    "totalMedia",
    "newMedia",
    "publicMedia",
    "privateMedia",
    "mediaByStatus",
  ],
  albums: ["totalAlbums", "newAlbums", "publicAlbums", "privateAlbums"],
  interactions: [
    "totalLikes",
    "newLikes",
    "totalBookmarks",
    "newBookmarks",
    "totalComments",
    "newComments",
    "totalViews",
    "newViews",
  ],
  generations: [
    "totalGenerations",
    "successfulGenerations",
    "failedGenerations",
    "averageGenerationTime",
  ],
  storage: [
    "totalStorageBytes",
    "totalStorageGB",
    "mediaStorageBytes",
    "thumbnailStorageBytes",
  ],
};

/**
 * Filters metrics object to only include fields relevant to the specified metric type
 */
function filterMetricsByType(
  metrics: AnalyticsMetrics,
  metricType: MetricType
): Partial<AnalyticsMetrics> {
  const relevantFields = METRIC_TYPE_MAPPING[metricType];
  const filteredMetrics: Partial<AnalyticsMetrics> = {};

  for (const field of relevantFields) {
    if (metrics[field] !== undefined) {
      filteredMetrics[field] = metrics[field];
    }
  }

  return filteredMetrics;
}

/**
 * Calculates user metrics for a given time range
 */
export async function calculateUserMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<Partial<AnalyticsMetrics>> {
  const metrics: Partial<AnalyticsMetrics> = {};

  try {
    // Get total users count
    const totalUsersResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "USER_USERNAME",
        },
        Select: "COUNT",
      })
    );
    metrics.totalUsers = totalUsersResult.Count || 0;

    // Get new users in time range
    const newUsersResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "begins_with(PK, :pk)",
        FilterExpression:
          "createdAt BETWEEN :start AND :end AND EntityType = :type",
        ExpressionAttributeValues: {
          ":pk": "USER#",
          ":start": startTime,
          ":end": endTime,
          ":type": "User",
        },
        Select: "COUNT",
      })
    );
    metrics.newUsers = newUsersResult.Count || 0;

    // Get active users (users with recent activity)
    const activeUsersResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "begins_with(PK, :pk)",
        FilterExpression:
          "lastActive BETWEEN :start AND :end AND EntityType = :type",
        ExpressionAttributeValues: {
          ":pk": "USER#",
          ":start": startTime,
          ":end": endTime,
          ":type": "User",
        },
        Select: "COUNT",
      })
    );
    metrics.activeUsers = activeUsersResult.Count || 0;
  } catch (error) {
    console.error("Error calculating user metrics:", error);
  }

  return metrics;
}

/**
 * Calculates media metrics for a given time range
 */
export async function calculateMediaMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<Partial<AnalyticsMetrics>> {
  const metrics: Partial<AnalyticsMetrics> = {};

  try {
    // Get total media count using GSI2
    const totalMediaResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "MEDIA_ID",
        },
        Select: "COUNT",
      })
    );
    metrics.totalMedia = totalMediaResult.Count || 0;

    // Get new media in time range using GSI4
    const newMediaResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI4",
        KeyConditionExpression:
          "GSI4PK = :pk AND GSI4SK BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": "MEDIA",
          ":start": startTime,
          ":end": `${endTime}#zzz`, // Ensure we capture all media up to end time
        },
        Select: "COUNT",
      })
    );
    metrics.newMedia = newMediaResult.Count || 0;

    // Get public media count using GSI5
    const publicMediaResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI5",
        KeyConditionExpression: "GSI5PK = :pk AND GSI5SK = :sk",
        ExpressionAttributeValues: {
          ":pk": "MEDIA",
          ":sk": "true",
        },
        Select: "COUNT",
      })
    );
    metrics.publicMedia = publicMediaResult.Count || 0;

    // Calculate private media
    metrics.privateMedia =
      (metrics.totalMedia || 0) - (metrics.publicMedia || 0);
  } catch (error) {
    console.error("Error calculating media metrics:", error);
  }

  return metrics;
}

/**
 * Calculates album metrics for a given time range
 */
export async function calculateAlbumMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<Partial<AnalyticsMetrics>> {
  const metrics: Partial<AnalyticsMetrics> = {};

  try {
    // Get total albums count using GSI1
    const totalAlbumsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "ALBUM",
        },
        Select: "COUNT",
      })
    );
    metrics.totalAlbums = totalAlbumsResult.Count || 0;

    // Get new albums in time range
    const newAlbumsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression:
          "GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": "ALBUM",
          ":start": startTime,
          ":end": `${endTime}#zzz`,
        },
        Select: "COUNT",
      })
    );
    metrics.newAlbums = newAlbumsResult.Count || 0;

    // Get public albums count using GSI5
    const publicAlbumsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI5",
        KeyConditionExpression: "GSI5PK = :pk AND GSI5SK = :sk",
        ExpressionAttributeValues: {
          ":pk": "ALBUM",
          ":sk": "true",
        },
        Select: "COUNT",
      })
    );
    metrics.publicAlbums = publicAlbumsResult.Count || 0;

    // Calculate private albums
    metrics.privateAlbums =
      (metrics.totalAlbums || 0) - (metrics.publicAlbums || 0);
  } catch (error) {
    console.error("Error calculating album metrics:", error);
  }

  return metrics;
}

/**
 * Calculates interaction metrics for a given time range
 */
export async function calculateInteractionMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<Partial<AnalyticsMetrics>> {
  const metrics: Partial<AnalyticsMetrics> = {};

  try {
    // Count likes
    const likesResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "begins_with(PK, :pk)",
        FilterExpression:
          "begins_with(SK, :sk) AND createdAt BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": "USER#",
          ":sk": "INTERACTION#like#",
          ":start": startTime,
          ":end": endTime,
        },
        Select: "COUNT",
      })
    );
    metrics.newLikes = likesResult.Count || 0;

    // Count bookmarks
    const bookmarksResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "begins_with(PK, :pk)",
        FilterExpression:
          "begins_with(SK, :sk) AND createdAt BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": "USER#",
          ":sk": "INTERACTION#bookmark#",
          ":start": startTime,
          ":end": endTime,
        },
        Select: "COUNT",
      })
    );
    metrics.newBookmarks = bookmarksResult.Count || 0;

    // Count comments
    const commentsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        FilterExpression: "createdAt BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": "COMMENTS_BY_USER",
          ":start": startTime,
          ":end": endTime,
        },
        Select: "COUNT",
      })
    );
    metrics.newComments = commentsResult.Count || 0;

    // For total counts, we'd need to scan all interactions (expensive)
    // Consider maintaining counters in cache for better performance
  } catch (error) {
    console.error("Error calculating interaction metrics:", error);
  }

  return metrics;
}

/**
 * Calculates storage metrics from S3
 */
export async function calculateStorageMetrics(
  s3Client: S3Client,
  bucket: string
): Promise<Partial<AnalyticsMetrics>> {
  const metrics: Partial<AnalyticsMetrics> = {};

  if (!bucket) {
    console.warn("S3 bucket not configured, skipping storage metrics");
    return metrics;
  }

  try {
    let totalBytes = 0;
    let continuationToken: string | undefined;

    do {
      const result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        })
      );

      if (result.Contents) {
        for (const object of result.Contents) {
          totalBytes += object.Size || 0;
        }
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    metrics.totalStorageBytes = totalBytes;
    metrics.totalStorageGB = Number((totalBytes / 1024 ** 3).toFixed(2));
  } catch (error) {
    console.error("Error calculating storage metrics:", error);
  }

  return metrics;
}

/**
 * Aggregates all metrics for a given time range
 */
export async function aggregateAllMetrics(
  docClient: DynamoDBDocumentClient,
  s3Client: S3Client | null,
  startTime: string,
  endTime: string
): Promise<AnalyticsMetrics> {
  // Run all metric calculations in parallel for efficiency
  const [
    userMetrics,
    mediaMetrics,
    albumMetrics,
    interactionMetrics,
    storageMetrics,
  ] = await Promise.all([
    calculateUserMetrics(docClient, startTime, endTime),
    calculateMediaMetrics(docClient, startTime, endTime),
    calculateAlbumMetrics(docClient, startTime, endTime),
    calculateInteractionMetrics(docClient, startTime, endTime),
    s3Client && S3_BUCKET
      ? calculateStorageMetrics(s3Client, S3_BUCKET)
      : Promise.resolve({}),
  ]);

  return {
    ...userMetrics,
    ...mediaMetrics,
    ...albumMetrics,
    ...interactionMetrics,
    ...storageMetrics,
  } as AnalyticsMetrics;
}

/**
 * Saves analytics entity to DynamoDB
 */
export async function saveAnalyticsEntity(
  docClient: DynamoDBDocumentClient,
  metricType: MetricType,
  granularity: MetricGranularity,
  timestamp: string,
  endTimestamp: string,
  metrics: AnalyticsMetrics
): Promise<void> {
  // Filter metrics to only include those relevant to the metric type
  const filteredMetrics = filterMetricsByType(metrics, metricType);

  const entity: AnalyticsEntity = {
    PK: `ANALYTICS#${metricType}#${granularity}`,
    SK: timestamp,
    GSI1PK: "ANALYTICS",
    GSI1SK: `${granularity}#${timestamp}#${metricType}`,
    GSI2PK: `ANALYTICS_TYPE#${metricType}`,
    GSI2SK: timestamp,
    EntityType: "Analytics",
    metricType,
    granularity,
    timestamp,
    endTimestamp,
    metrics: filteredMetrics,
    calculatedAt: new Date().toISOString(),
    version: 1,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: entity,
    })
  );

  console.log(
    `Saved analytics for ${metricType} ${granularity} at ${timestamp}`
  );
}

/**
 * Updates metrics cache for real-time access
 */
export async function updateMetricsCache(
  docClient: DynamoDBDocumentClient,
  cacheKey: string,
  value: number | string | object,
  ttlSeconds: number = 300 // Default 5 minutes
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + ttlSeconds;

  const cacheEntity: MetricsCacheEntity = {
    PK: "METRICS_CACHE",
    SK: cacheKey,
    EntityType: "MetricsCache",
    metricKey: cacheKey,
    value,
    lastUpdated: new Date().toISOString(),
    ttl,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: cacheEntity,
    })
  );
}

/**
 * Gets metrics from cache
 */
export async function getMetricsFromCache(
  docClient: DynamoDBDocumentClient,
  cacheKey: string
): Promise<MetricsCacheEntity | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": "METRICS_CACHE",
        ":sk": cacheKey,
      },
      Limit: 1,
    })
  );

  if (result.Items && result.Items.length > 0) {
    return result.Items[0] as MetricsCacheEntity;
  }

  return null;
}

/**
 * Batch update multiple cache entries
 */
export async function batchUpdateMetricsCache(
  docClient: DynamoDBDocumentClient,
  cacheUpdates: Array<{ key: string; value: any; ttl?: number }>
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const putRequests = cacheUpdates.map((update) => ({
    PutRequest: {
      Item: {
        PK: "METRICS_CACHE",
        SK: update.key,
        EntityType: "MetricsCache",
        metricKey: update.key,
        value: update.value,
        lastUpdated: new Date().toISOString(),
        ttl: now + (update.ttl || 300),
      },
    },
  }));

  // DynamoDB batch write has a limit of 25 items
  const chunks = [];
  for (let i = 0; i < putRequests.length; i += 25) {
    chunks.push(putRequests.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk,
        },
      })
    );
  }
}

/**
 * Query analytics data for a specific time range
 */
export async function queryAnalytics(
  docClient: DynamoDBDocumentClient,
  metricType: MetricType,
  granularity: MetricGranularity,
  startTime: string,
  endTime: string
): Promise<AnalyticsEntity[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": `ANALYTICS#${metricType}#${granularity}`,
        ":start": startTime,
        ":end": endTime,
      },
      ScanIndexForward: false, // Most recent first
    })
  );

  return (result.Items || []) as AnalyticsEntity[];
}

/**
 * Helper to get previous period metrics for comparison
 */
export async function getPreviousPeriodMetrics(
  docClient: DynamoDBDocumentClient,
  metricType: MetricType,
  granularity: MetricGranularity,
  currentTimestamp: string
): Promise<AnalyticsMetrics | null> {
  const previousDate = new Date(currentTimestamp);

  switch (granularity) {
    case "hourly":
      previousDate.setHours(previousDate.getHours() - 1);
      break;
    case "daily":
      previousDate.setDate(previousDate.getDate() - 1);
      break;
    case "weekly":
      previousDate.setDate(previousDate.getDate() - 7);
      break;
    case "monthly":
      previousDate.setMonth(previousDate.getMonth() - 1);
      break;
  }

  const result = await queryAnalytics(
    docClient,
    metricType,
    granularity,
    previousDate.toISOString(),
    previousDate.toISOString()
  );

  return result.length > 0 && result[0] ? result[0].metrics : null;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  current: number,
  previous: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

/**
 * Determine trend based on percentage change
 */
export function determineTrend(
  percentageChange: number
): "up" | "down" | "stable" {
  if (percentageChange > 5) return "up";
  if (percentageChange < -5) return "down";
  return "stable";
}
