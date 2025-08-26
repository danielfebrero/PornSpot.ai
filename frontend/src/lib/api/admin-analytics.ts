import { ApiUtil } from "../api-util";
import type {
  GetMetricsResponse,
  AdminDashboardStats,
  MetricGranularity,
  MetricTypeWithAll,
} from "@/types/shared-types";

// Type for frontend analytics params (extends GetMetricsRequest)
export interface AnalyticsMetricsParams {
  metricType: MetricTypeWithAll;
  granularity: MetricGranularity;
  startDate: string;
  endDate: string;
}

// Admin Analytics API Functions
export const adminAnalyticsApi = {
  // Get analytics metrics with specified parameters
  getMetrics: async (
    params: AnalyticsMetricsParams
  ): Promise<GetMetricsResponse> => {
    const queryParams = {
      metricType: params.metricType,
      granularity: params.granularity,
      startDate: params.startDate,
      endDate: params.endDate,
    };

    const response = await ApiUtil.get<GetMetricsResponse>(
      "/admin/analytics/metrics",
      queryParams
    );
    return ApiUtil.extractData(response);
  },

  // Get dashboard stats (simplified analytics for real-time display)
  getDashboardStats: async (): Promise<AdminDashboardStats> => {
    const response = await ApiUtil.get<AdminDashboardStats>(
      "/admin/analytics/dashboard"
    );
    return ApiUtil.extractData(response);
  },
};
