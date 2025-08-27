"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Users,
  Image,
  FolderOpen,
  Activity,
  Calendar,
  Clock,
  TrendingUp,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Lock,
  Cpu,
  HardDrive,
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
import { Line } from "react-chartjs-2";
import { useAdminAnalyticsQuery } from "@/hooks/queries/useAdminAnalyticsQuery";

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
  const [selectedGranularity, setSelectedGranularity] =
    useState<Granularity>("hourly");

  // Calculate date range based on granularity with useMemo to prevent unnecessary re-renders
  const dateRange = useMemo(() => {
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

    return getDateRange(selectedGranularity);
  }, [selectedGranularity]);

  // Fetch all analytics data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useAdminAnalyticsQuery({
    metricType: "all",
    granularity: selectedGranularity,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const chartColors = {
    users: {
      border: "rgba(99, 102, 241, 1)", // Indigo 500
      background: "rgba(99, 102, 241, 0.2)",
    },
    media: {
      border: "rgba(16, 185, 129, 1)", // Emerald 500
      background: "rgba(16, 185, 129, 0.2)",
    },
    albums: {
      border: "rgba(236, 72, 153, 1)", // Pink 500
      background: "rgba(236, 72, 153, 0.2)",
    },
    interactions: {
      border: "rgba(234, 179, 8, 1)", // Yellow 500
      background: "rgba(234, 179, 8, 0.25)",
    },
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#E5E7EB", // gris clair (lisible en dark mode)
          font: {
            family: "Inter, sans-serif",
            size: 12,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "#111827", // gris très foncé
        titleColor: "#F9FAFB", // blanc
        bodyColor: "#F3F4F6", // gris clair
        borderColor: "#374151", // gris neutre
        borderWidth: 1,
        padding: 10,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255,255,255,0.1)", // grille discrète
        },
        ticks: {
          color: "#D1D5DB", // gris clair
          font: {
            family: "Inter, sans-serif",
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: "rgba(255,255,255,0.1)",
        },
        ticks: {
          color: "#D1D5DB",
          font: {
            family: "Inter, sans-serif",
            size: 11,
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
    colorSet: { border: string; background: string }
  ) => {
    if (!analyticsData?.allMetrics) return null;

    const typeData = analyticsData.allMetrics.find(
      (m: any) => m.metricType === metricType
    );
    if (!typeData) return null;

    // Reverse the dataPoints to get chronological order
    const reversedDataPoints = [...typeData.dataPoints].reverse();

    const labels = reversedDataPoints.map((point: any) => {
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

    const data = reversedDataPoints.map(
      (point: any) => point.metrics[metricKey] || 0
    );

    return {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: colorSet.border,
          backgroundColor: colorSet.background,
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  // Process multi-line chart data
  const processMultiLineChartData = (
    metricType: string,
    metrics: Array<{
      key: string;
      label: string;
      borderColor: string;
      backgroundColor: string;
    }>
  ) => {
    if (!analyticsData?.allMetrics) return null;

    const typeData = analyticsData.allMetrics.find(
      (m: any) => m.metricType === metricType
    );
    if (!typeData) return null;

    // Reverse the dataPoints to get chronological order
    const reversedDataPoints = [...typeData.dataPoints].reverse();

    const labels = reversedDataPoints.map((point: any) => {
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

    const datasets = metrics.map((metric) => ({
      label: metric.label,
      data: reversedDataPoints.map(
        (point: any) => point.metrics[metric.key] || 0
      ),
      borderColor: metric.borderColor,
      backgroundColor: metric.backgroundColor,
      fill: false,
      tension: 0.4,
    }));

    return {
      labels,
      datasets,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
            <SummaryCard
              title={t("totalUsers")}
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "users"
                )?.dataPoints?.[0]?.metrics?.totalUsers || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "users"
                )?.dataPoints?.[0]?.metrics?.newUsers || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={Users}
              color="hsl(var(--chart-1))"
            />
            <SummaryCard
              title={t("totalMedia")}
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "media"
                )?.dataPoints?.[0]?.metrics?.totalMedia || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "media"
                )?.dataPoints?.[0]?.metrics?.newMedia || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={Image}
              color="hsl(var(--chart-2))"
            />
            <SummaryCard
              title={t("totalAlbums")}
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "albums"
                )?.dataPoints?.[0]?.metrics?.totalAlbums || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "albums"
                )?.dataPoints?.[0]?.metrics?.newAlbums || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={FolderOpen}
              color="hsl(var(--chart-3))"
            />
            <SummaryCard
              title={t("totalInteractions")}
              value={
                (analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalLikes || 0) +
                (analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalBookmarks || 0) +
                (analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalComments || 0)
              }
              change={
                (analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newLikes || 0) +
                (analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newBookmarks || 0) +
                (analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newComments || 0)
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={Activity}
              color="hsl(var(--chart-4))"
            />
            <SummaryCard
              title="Total Views"
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalViews || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newViews || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={Eye}
              color="hsl(var(--chart-5))"
            />
            <SummaryCard
              title="Total Likes"
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalLikes || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newLikes || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={Heart}
              color="hsl(var(--destructive))"
            />
            <SummaryCard
              title="Total Comments"
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalComments || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newComments || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={MessageCircle}
              color="hsl(var(--primary))"
            />
            <SummaryCard
              title="Total Bookmarks"
              value={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.totalBookmarks || 0
              }
              change={
                analyticsData?.allMetrics?.find(
                  (m: any) => m.metricType === "interactions"
                )?.dataPoints?.[0]?.metrics?.newBookmarks || 0
              }
              changeLabel={`last ${selectedGranularity
                .slice(0, -2)
                .replace("dai", "day")}`}
              icon={Bookmark}
              color="hsl(var(--muted-foreground))"
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            <ChartCard
              title="User Growth"
              subtitle={`New and active users per ${selectedGranularity.slice(
                0,
                -2
              )}`}
              icon={Users}
            >
              {(() => {
                const chartData = processMultiLineChartData("users", [
                  {
                    key: "newUsers",
                    label: "New Users",
                    borderColor: "rgba(99, 102, 241, 1)", // Indigo
                    backgroundColor: "rgba(99, 102, 241, 0.2)",
                  },
                  {
                    key: "activeUsers",
                    label: "Active Users",
                    borderColor: "rgba(16, 185, 129, 1)", // Emerald
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                  },
                ]);
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No user data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Media Generation Chart */}
            <ChartCard
              title="Media Generations"
              subtitle={`New media per ${selectedGranularity.slice(0, -2)}`}
              icon={Image}
            >
              {(() => {
                const chartData = processChartData(
                  "media",
                  "newMedia",
                  "New Media",
                  chartColors.media
                );
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
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
                  chartColors.albums
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
              subtitle={`Interactions per ${selectedGranularity.slice(0, -2)}`}
              icon={Activity}
            >
              {(() => {
                const chartData = processMultiLineChartData("interactions", [
                  {
                    key: "newLikes",
                    label: "New Likes",
                    borderColor: "rgba(234, 179, 8, 1)", // Yellow
                    backgroundColor: "rgba(234, 179, 8, 0.25)",
                  },
                  {
                    key: "newComments",
                    label: "New Comments",
                    borderColor: "rgba(168, 85, 247, 1)", // Purple
                    backgroundColor: "rgba(168, 85, 247, 0.2)",
                  },
                  {
                    key: "newBookmarks",
                    label: "New Bookmarks",
                    borderColor: "rgba(245, 101, 101, 1)", // Red
                    backgroundColor: "rgba(245, 101, 101, 0.2)",
                  },
                ]);
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No interaction data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Media Visibility Chart */}
            <ChartCard
              title="Media Visibility"
              subtitle={`Public vs Private media per ${selectedGranularity.slice(
                0,
                -2
              )}`}
              icon={Lock}
            >
              {(() => {
                const chartData = processMultiLineChartData("media", [
                  {
                    key: "publicMedia",
                    label: "Public Media",
                    borderColor: "rgba(34, 197, 94, 1)", // Green
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                  },
                  {
                    key: "privateMedia",
                    label: "Private Media",
                    borderColor: "rgba(239, 68, 68, 1)", // Red
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                  },
                ]);
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No media visibility data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Generations Chart */}
            <ChartCard
              title="AI Generations"
              subtitle={`Total generations per ${selectedGranularity.slice(
                0,
                -2
              )}`}
              icon={Cpu}
            >
              {(() => {
                const chartData = processChartData(
                  "generations",
                  "totalGenerations",
                  "Total Generations",
                  {
                    border: "rgba(147, 51, 234, 1)", // Purple
                    background: "rgba(147, 51, 234, 0.2)",
                  }
                );
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No generation data available
                  </div>
                );
              })()}
            </ChartCard>

            {/* Storage Usage Chart */}
            <ChartCard
              title="Storage Usage"
              subtitle={`Storage usage in GB per ${selectedGranularity.slice(
                0,
                -2
              )}`}
              icon={HardDrive}
            >
              {(() => {
                const chartData = processChartData(
                  "storage",
                  "totalStorageGB",
                  "Storage (GB)",
                  {
                    border: "rgba(59, 130, 246, 1)", // Blue
                    background: "rgba(59, 130, 246, 0.2)",
                  }
                );
                return chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No storage data available
                  </div>
                );
              })()}
            </ChartCard>
          </div>

          {/* Data Status */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Last updated:{" "}
                {analyticsData?.allMetrics?.[0]?.dataPoints?.[0]?.calculatedAt
                  ? new Date(
                      analyticsData.allMetrics[0].dataPoints[0].calculatedAt
                    ).toLocaleString()
                  : "Never"}
              </span>
              <span>
                Showing {selectedGranularity} data •
                {analyticsData?.combinedSummary?.totalDataPoints || 0} data
                points
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
