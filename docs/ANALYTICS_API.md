# Analytics API Documentation

## Overview

The PornSpot.ai Analytics API provides comprehensive metrics and insights for administrators to monitor platform performance, user engagement, and content growth. All analytics data is pre-calculated and stored at multiple time granularities for optimal query performance.

## Authentication

All analytics endpoints require **admin authentication**. Include the admin session token in the request headers:

```
Authorization: Bearer <admin-session-token>
```

## Base URL

```
https://api.pornspot.ai/{environment}/admin/analytics
```

Where `{environment}` is one of: `dev`, `stage`, `prod`

## API Endpoints

### 1. Get Analytics Metrics

Retrieves pre-calculated analytics data for specified metric type and time range.

**Endpoint**: `GET /admin/analytics/metrics`

**Query Parameters**:

- `metricType` (required): Type of metrics to retrieve
  - `users` - User registration and activity metrics
  - `media` - Media upload and engagement metrics
  - `albums` - Album creation and interaction metrics
  - `interactions` - Likes, bookmarks, comments, views
- `granularity` (required): Time aggregation level
  - `hourly` - Hour-by-hour breakdown
  - `daily` - Day-by-day breakdown
  - `weekly` - Week-by-week breakdown (Monday-Sunday)
  - `monthly` - Month-by-month breakdown
- `startDate` (required): Start date in ISO 8601 format (`YYYY-MM-DDTHH:MM:SS.SSSZ`)
- `endDate` (required): End date in ISO 8601 format (`YYYY-MM-DDTHH:MM:SS.SSSZ`)
- `metrics` (optional): Comma-separated list of specific metrics to include

**Example Request**:

```bash
curl -X GET \
  "https://api.pornspot.ai/dev/admin/analytics/metrics?metricType=users&granularity=daily&startDate=2023-12-01T00:00:00.000Z&endDate=2023-12-07T23:59:59.999Z" \
  -H "Authorization: Bearer <admin-token>"
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "metricType": "users",
    "granularity": "daily",
    "startDate": "2023-12-01T00:00:00.000Z",
    "endDate": "2023-12-07T23:59:59.999Z",
    "dataPoints": [
      {
        "timestamp": "2023-12-01T00:00:00.000Z",
        "endTimestamp": "2023-12-01T23:59:59.999Z",
        "metrics": {
          "totalUsers": 1250,
          "newUsers": 25,
          "activeUsers": 180,
          "deletedUsers": 2
        },
        "calculatedAt": "2023-12-02T00:05:00.000Z"
      },
      {
        "timestamp": "2023-12-02T00:00:00.000Z",
        "endTimestamp": "2023-12-02T23:59:59.999Z",
        "metrics": {
          "totalUsers": 1275,
          "newUsers": 30,
          "activeUsers": 195,
          "deletedUsers": 1
        },
        "calculatedAt": "2023-12-03T00:05:00.000Z"
      }
    ],
    "summary": {
      "totalDataPoints": 7,
      "averages": {
        "newUsers": 27.5,
        "activeUsers": 187.5
      },
      "totals": {
        "newUsers": 192,
        "totalUsers": 1275
      },
      "trends": {
        "newUsers": "up",
        "activeUsers": "stable"
      }
    }
  }
}
```

### 2. Get Dashboard Stats

Retrieves real-time metrics for the admin dashboard.

**Endpoint**: `GET /admin/analytics/dashboard`

**No Query Parameters Required**

**Example Request**:

```bash
curl -X GET \
  "https://api.pornspot.ai/dev/admin/analytics/dashboard" \
  -H "Authorization: Bearer <admin-token>"
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1275,
      "new24h": 30,
      "active24h": 195
    },
    "media": {
      "total": 5640,
      "new24h": 87,
      "public": 4200,
      "private": 1440
    },
    "albums": {
      "total": 890,
      "new24h": 12,
      "public": 650,
      "private": 240
    },
    "interactions": {
      "likes24h": 340,
      "bookmarks24h": 156,
      "comments24h": 89,
      "views24h": 2450
    },
    "storage": {
      "totalGB": 125.6,
      "usedPercent": 45.2
    },
    "lastUpdated": "2023-12-08T10:30:00.000Z"
  }
}
```

## Available Metrics

### User Metrics

- `totalUsers` - Total registered users
- `newUsers` - New user registrations in time period
- `activeUsers` - Users active in time period (based on `lastActive`)
- `deletedUsers` - Users who deleted their accounts

### Media Metrics

- `totalMedia` - Total media items uploaded
- `newMedia` - New media uploaded in time period
- `publicMedia` - Total public media items
- `privateMedia` - Total private media items
- `mediaByStatus.processing` - Media items currently processing
- `mediaByStatus.completed` - Successfully processed media
- `mediaByStatus.failed` - Failed media processing

### Album Metrics

- `totalAlbums` - Total albums created
- `newAlbums` - New albums created in time period
- `publicAlbums` - Total public albums
- `privateAlbums` - Total private albums

### Interaction Metrics

- `totalLikes` - Total likes across all content
- `newLikes` - New likes in time period
- `totalBookmarks` - Total bookmarks across all content
- `newBookmarks` - New bookmarks in time period
- `totalComments` - Total comments across all content
- `newComments` - New comments in time period
- `totalViews` - Total content views
- `newViews` - New views in time period

### Storage Metrics

- `totalStorageBytes` - Total storage used in bytes
- `totalStorageGB` - Total storage used in GB
- `mediaStorageBytes` - Storage used by original media
- `thumbnailStorageBytes` - Storage used by thumbnails

## Data Aggregation Schedule

Analytics data is automatically aggregated at the following intervals:

| Granularity | Schedule               | Purpose                                    |
| ----------- | ---------------------- | ------------------------------------------ |
| Hourly      | Every hour             | Real-time monitoring, short-term trends    |
| Daily       | 00:05 UTC daily        | Daily reporting, week-over-week comparison |
| Weekly      | 00:10 UTC Monday       | Weekly reports, month-over-month trends    |
| Monthly     | 00:15 UTC 1st of month | Monthly reporting, year-over-year analysis |

## Usage Examples

### Get Daily User Growth for Last Week

```bash
curl -X GET \
  "https://api.pornspot.ai/prod/admin/analytics/metrics?metricType=users&granularity=daily&startDate=2023-12-01T00:00:00.000Z&endDate=2023-12-07T23:59:59.999Z&metrics=totalUsers,newUsers,activeUsers" \
  -H "Authorization: Bearer <admin-token>"
```

### Get Hourly Media Uploads for Today

```bash
curl -X GET \
  "https://api.pornspot.ai/prod/admin/analytics/metrics?metricType=media&granularity=hourly&startDate=2023-12-08T00:00:00.000Z&endDate=2023-12-08T23:59:59.999Z&metrics=newMedia,totalMedia" \
  -H "Authorization: Bearer <admin-token>"
```

### Get Monthly Album Growth for This Year

```bash
curl -X GET \
  "https://api.pornspot.ai/prod/admin/analytics/metrics?metricType=albums&granularity=monthly&startDate=2023-01-01T00:00:00.000Z&endDate=2023-12-31T23:59:59.999Z" \
  -H "Authorization: Bearer <admin-token>"
```

### Get Real-time Dashboard Stats

```bash
curl -X GET \
  "https://api.pornspot.ai/prod/admin/analytics/dashboard" \
  -H "Authorization: Bearer <admin-token>"
```

## Frontend Integration

### React Hook Example

```typescript
import { useQuery } from "@tanstack/react-query";

export function useAnalytics(
  metricType: string,
  granularity: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ["analytics", metricType, granularity, startDate, endDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/analytics/metrics?metricType=${metricType}&granularity=${granularity}&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
          },
        }
      );
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Dashboard stats hook
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/dashboard", {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
      });
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
```

### Chart Integration Example

```typescript
import { Line } from "react-chartjs-2";

function UserGrowthChart() {
  const { data, isLoading } = useAnalytics(
    "users",
    "daily",
    "2023-11-01T00:00:00.000Z",
    "2023-12-01T00:00:00.000Z"
  );

  if (isLoading) return <div>Loading...</div>;

  const chartData = {
    labels: data?.dataPoints?.map((point) =>
      new Date(point.timestamp).toLocaleDateString()
    ),
    datasets: [
      {
        label: "New Users",
        data: data?.dataPoints?.map((point) => point.metrics.newUsers),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
      },
      {
        label: "Total Users",
        data: data?.dataPoints?.map((point) => point.metrics.totalUsers),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        yAxisID: "y1",
      },
    ],
  };

  return <Line data={chartData} />;
}
```

## Error Handling

### Common HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid parameters (missing required fields, invalid date format)
- `401 Unauthorized` - Missing or invalid admin authentication
- `404 Not Found` - Endpoint not found
- `500 Internal Server Error` - Server-side processing error

### Error Response Format

```json
{
  "success": false,
  "error": "Invalid parameters",
  "message": "metricType is required",
  "details": "Validation failed for query parameters"
}
```

### Error Examples

**Missing Required Parameter**:

```json
{
  "success": false,
  "error": "metricType is required"
}
```

**Invalid Date Format**:

```json
{
  "success": false,
  "error": "Invalid startDate format. Use ISO 8601 format"
}
```

**Invalid Metric Type**:

```json
{
  "success": false,
  "error": "Invalid metricType. Must be one of: users, media, albums, interactions"
}
```

## Performance Considerations

### Query Optimization

1. **Use appropriate granularity**: Hourly for detailed analysis, daily/weekly/monthly for trends
2. **Limit time ranges**: Large time ranges with hourly granularity may return many data points
3. **Filter specific metrics**: Use the `metrics` parameter to reduce response size
4. **Cache responses**: Analytics data doesn't change frequently, implement client-side caching

### Rate Limits

- **Dashboard stats**: Can be queried frequently (every 1-5 minutes)
- **Historical metrics**: Recommend caching for 5-10 minutes
- **Large time ranges**: Use pagination if implementing large historical queries

## Data Freshness

| Granularity | Data Freshness                       | Use Case                   |
| ----------- | ------------------------------------ | -------------------------- |
| Hourly      | 1 hour delay                         | Recent activity monitoring |
| Daily       | 5-60 minutes after midnight UTC      | Daily reports              |
| Weekly      | 10 minutes after Monday midnight UTC | Weekly summaries           |
| Monthly     | 15 minutes after 1st of month UTC    | Monthly reports            |

## Monitoring and Alerts

### CloudWatch Metrics

Analytics functions automatically emit CloudWatch metrics:

- `AnalyticsAggregationDuration` - Time taken to calculate metrics
- `AnalyticsAggregationErrors` - Number of failed aggregations
- `AnalyticsApiRequests` - Number of API requests
- `CacheHitRate` - Percentage of cache hits vs misses

### Recommended Alerts

```yaml
# CloudWatch Alarms (CloudFormation)
AnalyticsAggregationFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub "${Environment}-analytics-aggregation-failures"
    AlarmDescription: "Analytics aggregation is failing"
    MetricName: Errors
    Namespace: AWS/Lambda
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
    Dimensions:
      - Name: FunctionName
        Value: !Ref AnalyticsAggregateHourlyFunction
```

## Deployment Guide

### 1. Deploy Analytics Infrastructure

The analytics system is included in the main SAM template. Deploy using:

```bash
# Build and deploy
npm run build:backend
sam build
sam deploy --config-env dev  # or stage/prod
```

### 2. Verify Deployment

Check that all analytics functions are deployed:

```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `analytics`)].FunctionName'
```

Expected functions:

- `{env}-pornspot-analytics-get-metrics-v2`
- `{env}-pornspot-analytics-aggregate-hourly-v2`
- `{env}-pornspot-analytics-aggregate-daily-v2`
- `{env}-pornspot-analytics-aggregate-weekly-v2`
- `{env}-pornspot-analytics-aggregate-monthly-v2`

### 3. Verify EventBridge Rules

Check that scheduled rules are created:

```bash
aws events list-rules --query 'Rules[?contains(Name, `analytics`)].Name'
```

Expected rules:

- `{env}-pornspot-hourly-analytics`
- `{env}-pornspot-daily-analytics`
- `{env}-pornspot-weekly-analytics`
- `{env}-pornspot-monthly-analytics`

### 4. Initial Data Population

Since you started yesterday, the first metrics will be available:

- **Hourly metrics**: Available after the first hourly run
- **Daily metrics**: Available tomorrow at 00:05 UTC
- **Weekly metrics**: Available next Monday at 00:10 UTC
- **Monthly metrics**: Available on the 1st of next month at 00:15 UTC

### 5. Test the API

Test the analytics API endpoint:

```bash
# Get current dashboard stats
curl -X GET \
  "https://api.pornspot.ai/dev/admin/analytics/dashboard" \
  -H "Authorization: Bearer <admin-token>"

# Get hourly user metrics for today (will be empty until first aggregation runs)
curl -X GET \
  "https://api.pornspot.ai/dev/admin/analytics/metrics?metricType=users&granularity=hourly&startDate=$(date -u -d 'today 00:00:00' +%Y-%m-%dT%H:%M:%S.000Z)&endDate=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -H "Authorization: Bearer <admin-token>"
```

## Troubleshooting

### Common Issues

**1. No Data Available**

```json
{
  "success": true,
  "data": {
    "dataPoints": [],
    "summary": { "totalDataPoints": 0 }
  }
}
```

_Solution_: Wait for the first aggregation to run, or check if the time range is correct.

**2. Authentication Failed**

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

_Solution_: Verify admin session token is valid and user has admin role.

**3. Invalid Time Range**

```json
{
  "success": false,
  "error": "startDate must be before endDate"
}
```

_Solution_: Ensure startDate is chronologically before endDate.

### Debug Analytics Aggregation

Check CloudWatch Logs for aggregation functions:

```bash
# Check hourly aggregation logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/dev-pornspot-analytics-aggregate-hourly-v2" \
  --start-time $(date -d '1 hour ago' +%s)000

# Check if aggregation completed successfully
aws logs filter-log-events \
  --log-group-name "/aws/lambda/dev-pornspot-analytics-aggregate-hourly-v2" \
  --filter-pattern "✅ Successfully processed hourly metrics"
```

### Manual Aggregation Trigger

If needed, manually trigger aggregation:

```bash
# Trigger hourly aggregation
aws lambda invoke \
  --function-name "dev-pornspot-analytics-aggregate-hourly-v2" \
  --payload '{}' \
  response.json

# Check response
cat response.json
```

## Cost Optimization

### Expected Costs

For a platform with ~1000 users and ~5000 media items:

- **DynamoDB**: ~$0.50/month (analytics data storage)
- **Lambda**: ~$2.00/month (aggregation functions)
- **EventBridge**: ~$0.10/month (scheduled rules)

**Total estimated cost**: ~$2.60/month

### Cost Monitoring

Monitor analytics costs:

```bash
# Check DynamoDB table size
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value="dev-pornspot-media" \
  --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Data Retention

Analytics data retention policy:

- **Hourly data**: 30 days (automatic cleanup via TTL)
- **Daily data**: 1 year
- **Weekly data**: 2 years
- **Monthly data**: Indefinitely (for long-term trends)

## Adding New Metrics

To add a new metric:

1. **Update the metrics interface** in [`shared-types/analytics.ts`](../shared-types/analytics.ts):

```typescript
export interface AnalyticsMetrics {
  // ... existing metrics
  newCustomMetric?: number;
}
```

2. **Update calculation functions** in [`backend/shared/utils/analytics.ts`](../backend/shared/utils/analytics.ts):

```typescript
export async function calculateCustomMetrics(
  docClient: DynamoDBDocumentClient,
  startTime: string,
  endTime: string
): Promise<Partial<AnalyticsMetrics>> {
  // Implementation here
  return { newCustomMetric: calculatedValue };
}
```

3. **Update aggregation functions** to include the new metric calculation.

4. **Redeploy**: Run `sam build && sam deploy`

No database schema changes required - the flexible metrics object supports new fields automatically!

## Support

For issues with the analytics system:

1. Check CloudWatch Logs for error messages
2. Verify EventBridge rules are enabled
3. Ensure DynamoDB table has proper GSI configuration
4. Validate admin authentication tokens
