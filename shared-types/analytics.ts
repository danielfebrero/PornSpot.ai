// Analytics Types for PornSpot.ai

export type MetricGranularity = "hourly" | "daily" | "weekly" | "monthly";

export type MetricType =
  | "users"
  | "media"
  | "albums"
  | "interactions"
  | "generations"
  | "storage";

export type MetricTypeWithAll = MetricType | "all";

// Core metrics interface - flexible and extensible
export interface AnalyticsMetrics {
  // User metrics
  totalUsers?: number;
  newUsers?: number;
  activeUsers?: number;
  deletedUsers?: number;
  visitors?: number;

  // Media metrics
  totalMedia?: number;
  newMedia?: number;
  publicMedia?: number;
  privateMedia?: number;
  mediaByStatus?: {
    processing?: number;
    completed?: number;
    failed?: number;
  };

  // Album metrics
  totalAlbums?: number;
  newAlbums?: number;
  publicAlbums?: number;
  privateAlbums?: number;

  // Interaction metrics
  totalLikes?: number;
  newLikes?: number;
  totalBookmarks?: number;
  newBookmarks?: number;
  totalComments?: number;
  newComments?: number;
  totalViews?: number;
  newViews?: number;

  // Generation metrics
  totalGenerations?: number;
  successfulGenerations?: number;
  failedGenerations?: number;
  averageGenerationTime?: number;

  // Storage metrics
  totalStorageBytes?: number;
  totalStorageGB?: number;
  mediaStorageBytes?: number;
  thumbnailStorageBytes?: number;

  // Allow for future metrics without schema changes
  [key: string]: any;
}

// Request/Response types for API
export interface GetMetricsRequest {
  metricType: MetricTypeWithAll;
  granularity: MetricGranularity;
  startDate: string; // ISO 8601 date
  endDate: string; // ISO 8601 date
  metrics?: string[]; // Optional: specific metrics to retrieve
}

export interface GetMetricsResponse {
  metricType: MetricTypeWithAll;
  granularity: MetricGranularity;
  startDate: string;
  endDate: string;
  dataPoints?: AnalyticsDataPoint[];
  summary?: AnalyticsSummary;
  allMetrics?: Array<{
    metricType: MetricType;
    dataPoints: AnalyticsDataPoint[];
    summary: AnalyticsSummary;
  }>;
  combinedSummary?: {
    totalDataPoints: number;
    metricTypes: MetricType[];
  };
}

export interface AnalyticsDataPoint {
  timestamp: string; // ISO 8601 timestamp (start of period)
  endTimestamp: string; // ISO 8601 timestamp (end of period)
  metrics: AnalyticsMetrics;
  calculatedAt: string; // When this metric was calculated
}

export interface AnalyticsSummary {
  totalDataPoints: number;
  averages?: Partial<AnalyticsMetrics>;
  totals?: Partial<AnalyticsMetrics>;
  trends?: {
    [key: string]: "up" | "down" | "stable";
  };
}

// Real-time metrics cache
export interface MetricsCache {
  metricKey: string;
  value: number | string | object;
  lastUpdated: string;
  ttl?: number; // Seconds until expiration
}

// Aggregation job configuration
export interface AggregationConfig {
  metricType: MetricType;
  granularity: MetricGranularity;
  enabled: boolean;
  schedule?: string; // Cron expression or rate expression
  retentionDays?: number; // How long to keep this granularity
  backfillEnabled?: boolean;
}

// Admin dashboard stats (simplified real-time view)
export interface AdminDashboardStats {
  requestedBy: string;
  timestamp: string;
  timeRange: {
    last5Minutes: string;
    last30Minutes: string;
    current: string;
  };
  visitorCounts: {
    visitorsLast5Minutes: number;
    visitorsLast30Minutes: number;
  };
  summary: {
    visitorsLast5Minutes: number;
    visitorsLast30Minutes: number;
    timestamp: string;
  };
}

// Time range helpers
export interface TimeRange {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export interface TimeRangeQuery {
  granularity: MetricGranularity;
  range: TimeRange;
  timezone?: string; // IANA timezone (e.g., "Europe/Paris")
}

// Metric calculation helpers
export type MetricCalculator = (
  startTime: string,
  endTime: string
) => Promise<Partial<AnalyticsMetrics>>;

export interface MetricCalculatorRegistry {
  [key: string]: MetricCalculator;
}
