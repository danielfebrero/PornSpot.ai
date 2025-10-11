/**
 * @fileoverview Analytics Metrics Retrieval Handler
 * @description API endpoint for admins to query pre-aggregated analytics data with filtering, summaries, and trends.
 * @auth Requires admin authentication via LambdaHandlerUtil.withAdminAuth.
 * @queryParams metricType (required), granularity (required), startDate/endDate (required), metrics (optional comma-separated).
 * @notes
 * - Supports 'all' for multiple metric types or specific type.
 * - Validates params; queries DynamoDB for specified range/granularity.
 * - Filters metrics if specific fields requested.
 * - Calculates summaries: averages, trends (percentage change).
 * - Routes to dashboard stats for /dashboard path (real-time visitors).
 * - LocalStack config.
 * - Returns paginated data points and summary.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import {
  LambdaHandlerUtil,
  AdminAuthResult,
} from "@shared/utils/lambda-handler";
import {
  GetMetricsRequest,
  GetMetricsResponse,
  MetricType,
  MetricGranularity,
  AnalyticsDataPoint,
  AnalyticsSummary,
  MetricTypeWithAll,
} from "@shared/shared-types";
import {
  queryAnalytics,
  calculatePercentageChange,
  determineTrend,
  getRecentVisitorCounts,
} from "@shared/utils/analytics";
import { AnalyticsEntity } from "@shared/shared-types";

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

/**
 * Validates query parameters for the analytics API
 */
function validateQueryParams(event: APIGatewayProxyEvent): {
  isValid: boolean;
  error?: string;
  params?: GetMetricsRequest;
} {
  const { queryStringParameters } = event;

  if (!queryStringParameters) {
    return { isValid: false, error: "Query parameters are required" };
  }

  const { metricType, granularity, startDate, endDate, metrics } =
    queryStringParameters;

  // Required parameters
  if (!metricType) {
    return { isValid: false, error: "metricType is required" };
  }
  if (!granularity) {
    return { isValid: false, error: "granularity is required" };
  }
  if (!startDate) {
    return { isValid: false, error: "startDate is required" };
  }
  if (!endDate) {
    return { isValid: false, error: "endDate is required" };
  }

  // Validate metric type
  const validMetricTypes: MetricTypeWithAll[] = [
    "users",
    "media",
    "albums",
    "interactions",
    "storage",
    "generations",
    "business",
    "all",
  ];
  if (!validMetricTypes.includes(metricType as MetricTypeWithAll)) {
    return {
      isValid: false,
      error: `Invalid metricType. Must be one of: ${validMetricTypes.join(
        ", "
      )}`,
    };
  }

  // Validate granularity
  const validGranularities: MetricGranularity[] = [
    "hourly",
    "daily",
    "weekly",
    "monthly",
  ];
  if (!validGranularities.includes(granularity as MetricGranularity)) {
    return {
      isValid: false,
      error: `Invalid granularity. Must be one of: ${validGranularities.join(
        ", "
      )}`,
    };
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return {
      isValid: false,
      error: "Invalid startDate format. Use ISO 8601 format",
    };
  }
  if (isNaN(end.getTime())) {
    return {
      isValid: false,
      error: "Invalid endDate format. Use ISO 8601 format",
    };
  }
  if (start >= end) {
    return { isValid: false, error: "startDate must be before endDate" };
  }

  // Optional specific metrics filter
  const specificMetrics = metrics
    ? metrics.split(",").map((m) => m.trim())
    : undefined;

  return {
    isValid: true,
    params: {
      metricType: metricType as MetricType | "all",
      granularity: granularity as MetricGranularity,
      startDate,
      endDate,
      metrics: specificMetrics,
    },
  };
}

/**
 * Filters metrics based on requested fields
 */
function filterMetrics(metrics: any, requestedFields?: string[]): any {
  if (!requestedFields || requestedFields.length === 0) {
    return metrics;
  }

  const filtered: any = {};
  for (const field of requestedFields) {
    if (metrics[field] !== undefined) {
      filtered[field] = metrics[field];
    }
  }
  return filtered;
}

/**
 * Calculates summary statistics for the data points
 */
function calculateSummary(dataPoints: AnalyticsDataPoint[]): AnalyticsSummary {
  if (dataPoints.length === 0) {
    return {
      totalDataPoints: 0,
      averages: {},
      totals: {},
      trends: {},
    };
  }

  // Get all metric keys from the first data point
  const firstMetrics = dataPoints[0]?.metrics || {};
  const metricKeys = Object.keys(firstMetrics);

  const averages: any = {};
  const trends: any = {};

  // Calculate averages for each metric
  for (const key of metricKeys) {
    const values = dataPoints
      .map((dp) => dp.metrics[key])
      .filter((v) => typeof v === "number" && !isNaN(v)) as number[];

    if (values.length > 0) {
      // Always calculate averages
      averages[key] = Number(
        (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2)
      );

      // Calculate trends (compare first vs last values)
      if (values.length >= 2) {
        const first = values[0];
        const last = values[values.length - 1];
        if (typeof first === "number" && typeof last === "number") {
          const percentChange = calculatePercentageChange(last, first);
          trends[key] = determineTrend(percentChange);
        }
      }
    }
  }

  return {
    totalDataPoints: dataPoints.length,
    averages,
    trends,
  };
}

/**
 * Handles the main analytics query
 */
async function handleGetMetrics(
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> {
  const validation = validateQueryParams(event);

  if (!validation.isValid) {
    return ResponseUtil.badRequest(
      event,
      validation.error || "Invalid parameters"
    );
  }

  const params = validation.params!;

  console.log(`📊 Admin ${auth.username} requesting analytics:`, {
    metricType: params.metricType,
    granularity: params.granularity,
    startDate: params.startDate,
    endDate: params.endDate,
    specificMetrics: params.metrics,
  });

  try {
    let response: GetMetricsResponse;

    if (params.metricType === "all") {
      // Fetch all metric types in parallel
      const metricTypes: MetricType[] = [
        "users",
        "media",
        "albums",
        "interactions",
        "storage",
        "generations",
        "business",
      ];

      const allMetricsPromises = metricTypes.map(async (type) => {
        const analyticsData = await queryAnalytics(
          docClient,
          type,
          params.granularity,
          params.startDate,
          params.endDate
        );

        const dataPoints: AnalyticsDataPoint[] = analyticsData.map(
          (entity: AnalyticsEntity) => ({
            timestamp: entity.timestamp,
            endTimestamp: entity.endTimestamp,
            metrics: filterMetrics(entity.metrics, params.metrics),
            calculatedAt: entity.calculatedAt,
          })
        );

        return {
          metricType: type,
          dataPoints,
          summary: calculateSummary(dataPoints),
        };
      });

      const allResults = await Promise.all(allMetricsPromises);

      response = {
        metricType: "all",
        granularity: params.granularity,
        startDate: params.startDate,
        endDate: params.endDate,
        allMetrics: allResults,
      };

      console.log(`✅ Successfully retrieved all metrics`);
    } else {
      // Query single metric type
      const analyticsData = await queryAnalytics(
        docClient,
        params.metricType as MetricType,
        params.granularity,
        params.startDate,
        params.endDate
      );

      const dataPoints: AnalyticsDataPoint[] = analyticsData.map(
        (entity: AnalyticsEntity) => ({
          timestamp: entity.timestamp,
          endTimestamp: entity.endTimestamp,
          metrics: filterMetrics(entity.metrics, params.metrics),
          calculatedAt: entity.calculatedAt,
        })
      );

      const summary = calculateSummary(dataPoints);

      response = {
        metricType: params.metricType,
        granularity: params.granularity,
        startDate: params.startDate,
        endDate: params.endDate,
        dataPoints,
        summary,
      };

      console.log(
        `✅ Successfully retrieved ${dataPoints.length} data points for ${params.metricType}`
      );
    }

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("❌ Error retrieving analytics metrics:", error);
    return ResponseUtil.error(event, "Failed to retrieve metrics");
  }
}

/**
 * Handles real-time dashboard stats request
 */
async function handleGetDashboardStats(
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> {
  console.log(`📊 Admin ${auth.username} requesting dashboard stats`);

  try {
    console.log(`📊 Getting recent visitor counts for dashboard stats`);
    const visitorCounts = await getRecentVisitorCounts(docClient);
    console.log(
      `✅ Retrieved visitor counts: ${visitorCounts.visitorsLast5Minutes} (5min), ${visitorCounts.visitorsLast30Minutes} (30min)`
    );

    const dashboardStats = {
      requestedBy: auth.username,
      timestamp: new Date().toISOString(),
      timeRange: {
        last5Minutes: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        last30Minutes: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        current: new Date().toISOString(),
      },
      visitorCounts,
      summary: {
        visitorsLast5Minutes: visitorCounts.visitorsLast5Minutes,
        visitorsLast30Minutes: visitorCounts.visitorsLast30Minutes,
        timestamp: new Date().toISOString(),
      },
    };

    return ResponseUtil.success(event, dashboardStats);
  } catch (error) {
    console.error("❌ Error retrieving dashboard stats:", error);
    return ResponseUtil.error(event, "Failed to retrieve dashboard stats");
  }
}

/**
 * Main Lambda handler with routing
 */
const handleAnalyticsRequest = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  const path = event.path;
  const method = event.httpMethod;

  // Route based on path and method
  if (method === "GET") {
    if (path.includes("/dashboard")) {
      return handleGetDashboardStats(event, auth);
    } else {
      return handleGetMetrics(event, auth);
    }
  }

  return ResponseUtil.methodNotAllowed(event, `Method ${method} not allowed`);
};

// Export the handler with admin authentication
export const handler = LambdaHandlerUtil.withAdminAuth(handleAnalyticsRequest);
