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
  users: ["totalUsers", "newUsers", "activeUsers", "deletedUsers", "visitors"],
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

export async function calculateGenerationMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<Partial<AnalyticsMetrics>> {
  const metrics: Partial<AnalyticsMetrics> = {};

  try {
    // Get total generations count using GSI6
    let totalGenerationsCount = 0;
    let lastKey;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI6",
          KeyConditionExpression: "GSI6PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "GENERATION_ID",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      totalGenerationsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalGenerations = totalGenerationsCount;

    // Get successful generations in time range using GSI6
    let successfulGenerationsCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI6",
          KeyConditionExpression:
            "GSI6PK = :pk AND GSI6SK BETWEEN :start AND :end",
          FilterExpression: "status = :status",
          ExpressionAttributeValues: {
            ":pk": "GENERATION",
            ":start": startTime,
            ":end": `${endTime}#zzz`,
            ":status": "successful",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      successfulGenerationsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.successfulGenerations = successfulGenerationsCount;

    // Get failed generations in time range using GSI6
    let failedGenerationsCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI6",
          KeyConditionExpression:
            "GSI6PK = :pk AND GSI6SK BETWEEN :start AND :end",
          FilterExpression: "status = :status",
          ExpressionAttributeValues: {
            ":pk": "GENERATION",
            ":start": startTime,
            ":end": `${endTime}#zzz`,
            ":status": "failed",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      failedGenerationsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.failedGenerations = failedGenerationsCount;
  } catch (error) {
    console.error("Error calculating generation metrics:", error);
  }

  return metrics;
}

export async function calculateActiveUsers(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<number> {
  // Get active users (users with recent activity) - use GSI3 to get all users then filter
  let activeUsersCount = 0;
  let lastKey = undefined;
  do {
    const res: any = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :pk",
        FilterExpression:
          "lastActive BETWEEN :start AND :end AND EntityType = :type",
        ExpressionAttributeValues: {
          ":pk": "USER_USERNAME",
          ":start": startTime,
          ":end": endTime,
          ":type": "User",
        },
        Select: "COUNT",
        ExclusiveStartKey: lastKey,
      })
    );
    activeUsersCount += res?.Count || 0;
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return activeUsersCount;
}

export async function calculateVisitorCount(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<number> {
  // Get visitors count in time range - count distinct clientIP only
  const uniqueClientIPs = new Set<string>();
  let lastKey = undefined;
  do {
    const res: any = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: "#ts BETWEEN :start AND :end",
        ExpressionAttributeNames: {
          "#ts": "timestamp",
        },
        ExpressionAttributeValues: {
          ":pk": "VISITOR",
          ":start": startTime,
          ":end": endTime,
        },
        ProjectionExpression: "clientIP",
        ExclusiveStartKey: lastKey,
      })
    );

    // Add each unique clientIP to the set
    if (res.Items) {
      for (const item of res.Items) {
        if (item.clientIP) {
          uniqueClientIPs.add(item.clientIP);
        }
      }
    }

    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return uniqueClientIPs.size;
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
    // Get total users count - filter by active users only
    let totalUsersCount = 0;
    let lastKey;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression: "GSI3PK = :pk",
          FilterExpression: "isActive = :isActive AND EntityType = :type",
          ExpressionAttributeValues: {
            ":pk": "USER_USERNAME",
            ":isActive": true,
            ":type": "User",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      totalUsersCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalUsers = totalUsersCount;

    // Get new users in time range - use GSI3 to get all users then filter by active and creation date
    let newUsersCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression: "GSI3PK = :pk",
          FilterExpression:
            "createdAt BETWEEN :start AND :end AND EntityType = :type AND isActive = :isActive",
          ExpressionAttributeValues: {
            ":pk": "USER_USERNAME",
            ":start": startTime,
            ":end": endTime,
            ":type": "User",
            ":isActive": true,
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      newUsersCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.newUsers = newUsersCount;

    // Get active users (users with recent activity) - use GSI3 to get all users then filter

    metrics.activeUsers = await calculateActiveUsers(
      docClient,
      startTime,
      endTime
    );

    metrics.visitors = await calculateVisitorCount(
      docClient,
      startTime,
      endTime
    );
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
    let count = 0;
    let lastKey;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "MEDIA_ID",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      count += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalMedia = count;

    // Get new media in time range using GSI4
    let newMediaCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
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
          ExclusiveStartKey: lastKey,
        })
      );
      newMediaCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.newMedia = newMediaCount;

    // Get public media count using GSI5
    let publicMediaCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI5",
          KeyConditionExpression: "GSI5PK = :pk AND GSI5SK = :sk",
          ExpressionAttributeValues: {
            ":pk": "MEDIA",
            ":sk": "true",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      publicMediaCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.publicMedia = publicMediaCount;

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
    let totalAlbumsCount = 0;
    let lastKey;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "ALBUM",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      totalAlbumsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalAlbums = totalAlbumsCount;

    // Get new albums in time range
    let newAlbumsCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
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
          ExclusiveStartKey: lastKey,
        })
      );
      newAlbumsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.newAlbums = newAlbumsCount;

    // Get public albums count using GSI5
    let publicAlbumsCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI5",
          KeyConditionExpression: "GSI5PK = :pk AND GSI5SK = :sk",
          ExpressionAttributeValues: {
            ":pk": "ALBUM",
            ":sk": "true",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      publicAlbumsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.publicAlbums = publicAlbumsCount;

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
    // Count new likes - use GSI3 to query interactions by type
    let newLikesCount = 0;
    let lastKey;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression:
            "GSI3PK = :pk AND GSI3SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": "INTERACTION#like",
            ":start": startTime,
            ":end": endTime,
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      newLikesCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.newLikes = newLikesCount;

    // Count new bookmarks - use GSI3 to query interactions by type
    let newBookmarksCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression:
            "GSI3PK = :pk AND GSI3SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": "INTERACTION#bookmark",
            ":start": startTime,
            ":end": endTime,
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      newBookmarksCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.newBookmarks = newBookmarksCount;

    // Count new comments
    let newCommentsCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression:
            "GSI3PK = :pk AND GSI3SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": "INTERACTION#comment",
            ":start": startTime,
            ":end": endTime,
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      newCommentsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.newComments = newCommentsCount;

    // Calculate total counts (all time) using GSI3
    let totalLikesCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression: "GSI3PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "INTERACTION#like",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      totalLikesCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalLikes = totalLikesCount;

    let totalBookmarksCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression: "GSI3PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "INTERACTION#bookmark",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      totalBookmarksCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalBookmarks = totalBookmarksCount;

    // Calculate total comments using GSI3
    let totalCommentsCount = 0;
    lastKey = undefined;
    do {
      const res: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI3",
          KeyConditionExpression: "GSI3PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "INTERACTION#comment",
          },
          Select: "COUNT",
          ExclusiveStartKey: lastKey,
        })
      );
      totalCommentsCount += res?.Count || 0;
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    metrics.totalComments = totalCommentsCount;

    // Calculate totalViews and newViews using our ViewCount entities
    const viewMetrics = await calculateViewMetrics(
      docClient,
      startTime,
      endTime
    );
    metrics.totalViews = viewMetrics.totalViews || 0;
    metrics.newViews = viewMetrics.newViews || 0;
  } catch (error) {
    console.error("Error calculating interaction metrics:", error);
  }

  return metrics;
}

/**
 * Calculates view metrics using ViewCount entities
 */
async function calculateViewMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<{ totalViews: number; newViews: number }> {
  try {
    // For totalViews: Sum all monthly view counts to get the total
    let totalViews = 0;
    let lastKey;

    do {
      const monthlyResult: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": "VIEW_COUNT#monthly",
          },
          ExclusiveStartKey: lastKey,
        })
      );

      if (monthlyResult.Items) {
        for (const item of monthlyResult.Items) {
          totalViews += (item["newViews"] as number) || 0;
        }
      }

      lastKey = monthlyResult.LastEvaluatedKey;
    } while (lastKey);

    // For newViews: Get the current period view count based on time range
    let newViews = 0;
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    let granularity: string;
    let periodStart: Date;

    // Determine granularity based on time range
    if (hoursDiff <= 1) {
      // Hourly period
      granularity = "hourly";
      periodStart = new Date(startDate);
      periodStart.setMinutes(0, 0, 0);
    } else if (hoursDiff <= 24) {
      // Daily period
      granularity = "daily";
      periodStart = new Date(startDate);
      periodStart.setHours(0, 0, 0, 0);
    } else if (hoursDiff <= 168) {
      // Weekly period (168 hours = 7 days)
      granularity = "weekly";
      periodStart = new Date(startDate);
      const dayOfWeek = periodStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStart.setDate(periodStart.getDate() - daysToMonday);
      periodStart.setHours(0, 0, 0, 0);
    } else {
      // Monthly period
      granularity = "monthly";
      periodStart = new Date(startDate);
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }

    // Get the view count for the current period
    try {
      const periodResult: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND SK = :sk",
          ExpressionAttributeValues: {
            ":pk": `VIEW_COUNT#${granularity}`,
            ":sk": periodStart.toISOString(),
          },
        })
      );

      if (periodResult.Items && periodResult.Items.length > 0) {
        newViews = (periodResult.Items[0]["newViews"] as number) || 0;
      }
    } catch (error) {
      console.warn(`Failed to get ${granularity} view count:`, error);
    }

    return { totalViews, newViews };
  } catch (error) {
    console.error("Error calculating view metrics:", error);
    return { totalViews: 0, newViews: 0 };
  }
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
  s3Client: S3Client,
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
    calculateGenerationMetrics(docClient, startTime, endTime),
    calculateStorageMetrics(s3Client, S3_BUCKET!),
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

/**
 * Get visitor count for specific time windows based on lastSeen field
 * @param docClient - DynamoDB document client
 * @returns Object with visitor counts for 5-minute and 30-minute windows
 */
export async function getRecentVisitorCounts(
  docClient: DynamoDBDocumentClient
): Promise<{ visitorsLast5Minutes: number; visitorsLast30Minutes: number }> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const thirtyMinutesAgo = new Date(
    now.getTime() - 30 * 60 * 1000
  ).toISOString();

  const uniqueVisitors5Min = new Set<string>();
  const uniqueVisitors30Min = new Set<string>();
  let lastKey;

  try {
    do {
      const result: any = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: "#ls >= :thirtyMinutesAgo",
          ExpressionAttributeNames: {
            "#ls": "lastSeen",
          },
          ExpressionAttributeValues: {
            ":pk": "VISITOR",
            ":thirtyMinutesAgo": thirtyMinutesAgo,
          },
          ProjectionExpression: "#ls, clientIP",
          ExclusiveStartKey: lastKey,
        })
      );

      if (result.Items) {
        for (const item of result.Items) {
          if (item.lastSeen && item.clientIP) {
            const lastSeenTime = new Date(item.lastSeen);
            const fiveMinutesAgoTime = new Date(fiveMinutesAgo);

            // Count visitors active in last 30 minutes
            uniqueVisitors30Min.add(item.clientIP);

            // Count visitors active in last 5 minutes
            if (lastSeenTime >= fiveMinutesAgoTime) {
              uniqueVisitors5Min.add(item.clientIP);
            }
          }
        }
      }

      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return {
      visitorsLast5Minutes: uniqueVisitors5Min.size,
      visitorsLast30Minutes: uniqueVisitors30Min.size,
    };
  } catch (error) {
    console.error("Error getting recent visitor counts:", error);
    throw error;
  }
}
