"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Users,
  Image,
  FolderOpen,
  Activity,
  Calendar,
  Clock,
  Zap,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { useAdminContext } from "@/contexts/AdminContext";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Granularity = "hourly" | "daily" | "weekly" | "monthly";

export default function AnalyticsPage() {
  const t = useTranslations("admin.analytics");
  const tGranularity = useTranslations("admin.analytics.granularity");
  const { user } = useAdminContext();
  const [selectedGranularity, setSelectedGranularity] =
    useState<Granularity>("daily");

  // Calculate date range based on granularity
  const getDateRange = (granularity: Granularity) => {
    const end = new Date();
    const start = new Date();

    switch (granularity) {
      case "hourly":
        start.setHours(start.getHours() - 24); // Last 24 hours
        break;
      case "daily":
        start.setDate(start.getDate() - 30); // Last 30 days
        break;
      case "weekly":
        start.setDate(start.getDate() - 84); // Last 12 weeks
        break;
      case "monthly":
        start.setMonth(start.getMonth() - 12); // Last 12 months
        break;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const dateRange = getDateRange(selectedGranularity);

  // Fetch all analytics data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "admin-analytics-all",
      selectedGranularity,
      dateRange.start,
      dateRange.end,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        metricType: "all",
        granularity: selectedGranularity,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      const response = await fetch(`/api/admin/analytics/metrics?${params}`, {
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  });

  // Chart.js theme configuration for dark mode
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "hsl(var(--muted-foreground))",
          font: {
            family: "Inter, sans-serif",
          },
        },
      },
      tooltip: {
        backgroundColor: "hsl(var(--popover))",
        titleColor: "hsl(var(--popover-foreground))",
        bodyColor: "hsl(var(--popover-foreground))",
        borderColor: "hsl(var(--border))",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: "hsl(var(--border))",
        },
        ticks: {
          color: "hsl(var(--muted-foreground))",
          font: {
            family: "Inter, sans-serif",
          },
        },
      },
      y: {
        grid: {
          color: "hsl(var(--border))",
        },
        ticks: {
          color: "hsl(var(--muted-foreground))",
          font: {
            family: "Inter, sans-serif",
          },
        },
      },
    },
  };

  // Process chart data
  const processChartData = (
    metricType: string,
    metricKey: string,
    label: string,
    color: string
  ) => {
    if (!analyticsData?.data?.allMetrics) return null;

    const typeData = analyticsData.data.allMetrics.find(
      (m: any) => m.metricType === metricType
    );
    if (!typeData) return null;

    const labels = typeData.dataPoints.map((point: any) => {
      const date = new Date(point.timestamp);
      switch (selectedGranularity) {
        case "hourly":
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        case "daily":
          return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
          });
        case "weekly":
          return `Week ${Math.ceil(
            date.getDate() / 7
          )} - ${date.toLocaleDateString([], { month: "short" })}`;
        case "monthly":
          return date.toLocaleDateString([], {
            month: "short",
            year: "numeric",
          });
        default:
          return date.toLocaleDateString();
      }
    });

    const data = typeData.dataPoints.map(
      (point: any) => point.metrics[metricKey] || 0
    );

    return {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: color + "20",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  const granularityOptions = [
    { value: "hourly", label: tGranularity("hourly"), icon: Clock },
    { value: "daily", label: tGranularity("daily"), icon: Calendar },
    { value: "weekly", label: tGranularity("weekly"), icon: TrendingUp },
    { value: "monthly", label: tGranularity("monthly"), icon: BarChart3 },
  ];

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Failed to load analytics
          </h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        {/* Granularity Selector */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          {granularityOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() =>
                  setSelectedGranularity(option.value as Granularity)
                }
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${
                    selectedGranularity === option.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background"
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded mb-4 w-1/3"></div>
                <div className="h-48 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title={t("totalUsers")}
              value={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "users"
                )?.summary?.totals?.totalUsers || 0
              }
              change={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "users"
                )?.summary?.totals?.newUsers || 0
              }
              changeLabel={`new this ${selectedGranularity.slice(0, -2)}`}
              icon={Users}
              color="hsl(var(--chart-1))"
            />
            <SummaryCard
              title={t("totalMedia")}
              value={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "media"
                )?.summary?.totals?.totalMedia || 0
              }
              change={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "media"
                )?.summary?.totals?.newMedia || 0
              }
              changeLabel={`new this ${selectedGranularity.slice(0, -2)}`}
              icon={Image}
              color="hsl(var(--chart-2))"
            />
            <SummaryCard
              title={t("totalAlbums")}
              value={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "albums"
                )?.summary?.totals?.totalAlbums || 0
              }
              change={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "albums"
                )?.summary?.totals?.newAlbums || 0
              }
              changeLabel={`new this ${selectedGranularity.slice(0, -2)}`}
              icon={FolderOpen}
              color="hsl(var(--chart-3))"
            />
            <SummaryCard
              title={t("totalInteractions")}
              value={
                (analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.summary?.totals?.newLikes || 0) +
                (analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.summary?.totals?.newBookmarks || 0) +
                (analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.summary?.totals?.newComments || 0)
              }
              change={
                analyticsData?.data?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.summary?.totals?.newLikes || 0
              }
              changeLabel="new likes"
              icon={Activity}
              color="hsl(var(--chart-4))"
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            <ChartCard
              title="User Growth"
              subtitle={`New users per ${selectedGranularity.slice(0, -2)}`}
              icon={Users}
            >
              {(() => {
                const chartData = processChartData(
                  "users",
                  "newUsers",
                  "New Users",
                  "hsl(var(--chart-1))"
                );
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No user data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Media Upload Chart */}
            <ChartCard
              title="Media Uploads"
              subtitle={`New media per ${selectedGranularity.slice(0, -2)}`}
              icon={Image}
            >
              {(() => {
                const chartData = processChartData(
                  "media",
                  "newMedia",
                  "New Media",
                  "hsl(var(--chart-2))"
                );
                return chartData ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No media data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Album Creation Chart */}
            <ChartCard
              title="Album Creation"
              subtitle={`New albums per ${selectedGranularity.slice(0, -2)}`}
              icon={FolderOpen}
            >
              {(() => {
                const chartData = processChartData(
                  "albums",
                  "newAlbums",
                  "New Albums",
                  "hsl(var(--chart-3))"
                );
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No album data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Engagement Chart */}
            <ChartCard
              title="User Engagement"
              subtitle={`Likes per ${selectedGranularity.slice(0, -2)}`}
              icon={Activity}
            >
              {(() => {
                const chartData = processChartData(
                  "interactions",
                  "newLikes",
                  "New Likes",
                  "hsl(var(--chart-4))"
                );
                return chartData ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No interaction data available
                  </div>
                );
              })()}
            </ChartCard>
          </div>

          {/* Combined Overview Chart - Full Width */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Platform Overview
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Combined metrics showing platform growth
                  </p>
                </div>
              </div>

              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="h-80 bg-muted rounded animate-pulse"></div>
            ) : (
              (() => {
                const usersData = processChartData(
                  "users",
                  "newUsers",
                  "New Users",
                  "hsl(var(--chart-1))"
                );
                const mediaData = processChartData(
                  "media",
                  "newMedia",
                  "New Media",
                  "hsl(var(--chart-2))"
                );
                const albumsData = processChartData(
                  "albums",
                  "newAlbums",
                  "New Albums",
                  "hsl(var(--chart-3))"
                );
                const likesData = processChartData(
                  "interactions",
                  "newLikes",
                  "New Likes",
                  "hsl(var(--chart-4))"
                );

                if (!usersData && !mediaData && !albumsData && !likesData) {
                  return (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No data available for the selected time period
                    </div>
                  );
                }

                const combinedData = {
                  labels:
                    usersData?.labels ||
                    mediaData?.labels ||
                    albumsData?.labels ||
                    [],
                  datasets: [
                    ...(usersData ? [usersData.datasets[0]] : []),
                    ...(mediaData
                      ? [
                          {
                            ...mediaData.datasets[0],
                            borderColor: "hsl(var(--chart-2))",
                            backgroundColor: "hsl(var(--chart-2))" + "20",
                          },
                        ]
                      : []),
                    ...(albumsData
                      ? [
                          {
                            ...albumsData.datasets[0],
                            borderColor: "hsl(var(--chart-3))",
                            backgroundColor: "hsl(var(--chart-3))" + "20",
                          },
                        ]
                      : []),
                    ...(likesData
                      ? [
                          {
                            ...likesData.datasets[0],
                            borderColor: "hsl(var(--chart-4))",
                            backgroundColor: "hsl(var(--chart-4))" + "20",
                          },
                        ]
                      : []),
                  ],
                };

                return (
                  <div className="h-80">
                    <Line
                      data={combinedData}
                      options={{
                        ...chartOptions,
                        interaction: {
                          mode: "index",
                          intersect: false,
                        },
                      }}
                    />
                  </div>
                );
              })()
            )}
          </div>

          {/* Data Status */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Last updated:{" "}
                {analyticsData?.data?.allMetrics?.[0]?.dataPoints?.[0]
                  ?.calculatedAt
                  ? new Date(
                      analyticsData.data.allMetrics[0].dataPoints[0].calculatedAt
                    ).toLocaleString()
                  : "Never"}
              </span>
              <span>
                Showing {selectedGranularity} data •
                {analyticsData?.data?.combinedSummary?.totalDataPoints || 0}{" "}
                data points
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  title: string;
  value: number;
  change: number;
  changeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function SummaryCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color,
}: SummaryCardProps) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: color + "20", color: color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <TrendingUp className="h-4 w-4 text-green-500" />
        <span className="font-medium text-foreground">
          +{change.toLocaleString()}
        </span>
        <span className="text-muted-foreground">{changeLabel}</span>
      </div>
    </div>
  );
}

// Chart Card Component
interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, icon: Icon, children }: ChartCardProps) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="h-64">{children}</div>
    </div>
  );
}
