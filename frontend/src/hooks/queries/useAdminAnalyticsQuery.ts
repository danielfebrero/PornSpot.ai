import { useQuery } from "@tanstack/react-query";
import {
  adminAnalyticsApi,
  AnalyticsMetricsParams,
} from "@/lib/api/admin-analytics";
import { queryKeys } from "@/lib/queryClient";
import type {
  GetMetricsResponse,
  AdminDashboardStats,
} from "@/types/shared-types";

// Hook for fetching analytics metrics with specified parameters
export function useAdminAnalyticsQuery(params: AnalyticsMetricsParams) {
  return useQuery({
    queryKey: queryKeys.admin.analytics.metrics({
      metricType: params.metricType,
      granularity: params.granularity,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    queryFn: async (): Promise<GetMetricsResponse> => {
      return await adminAnalyticsApi.getMetrics(params);
    },
    // Keep analytics data fresh for 5 minutes since it's pre-calculated
    staleTime: 5 * 60 * 1000,
    // Enable background refetching for admin data
    refetchOnWindowFocus: true,
    // Refresh every 10 minutes for updated analytics
    refetchInterval: 10 * 60 * 1000,
    // Retry failed requests (important for admin analytics)
    retry: 3,
    // Keep trying to fetch even if offline (will work when back online)
    retryOnMount: true,
  });
}

// Hook for fetching admin dashboard stats (real-time simplified metrics)
export function useAdminDashboardStatsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.analytics.dashboard(),
    queryFn: async (): Promise<AdminDashboardStats> => {
      return await adminAnalyticsApi.getDashboardStats();
    },
    // Keep dashboard stats fresh for 1 minute since they change frequently
    staleTime: 60 * 1000,
    // Enable background refetching for real-time stats
    refetchOnWindowFocus: true,
    // Refetch every 5 minutes for real-time dashboard
    refetchInterval: 5 * 60 * 1000,
    // Retry failed requests (important for admin dashboard)
    retry: 3,
    // Keep trying to fetch even if offline (will work when back online)
    retryOnMount: true,
  });
}
