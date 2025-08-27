"use client";

import { useAdminContext } from "@/contexts/AdminContext";
import { useTranslations } from "next-intl";
import { useAdminDashboardStatsQuery } from "@/hooks/queries/useAdminAnalyticsQuery";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminDashboard() {
  const { user } = useAdminContext();
  const t = useTranslations("admin.dashboard");

  // Fetch dashboard stats
  const {
    data: dashboardStats,
    isLoading,
    error,
    refetch,
  } = useAdminDashboardStatsQuery();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#F9FAFB",
        bodyColor: "#F3F4F6",
        borderColor: "#374151",
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            return `Minute: ${context[0].label}`;
          },
          label: (context: any) => {
            return `Visitors: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255,255,255,0.1)",
        },
        ticks: {
          color: "#D1D5DB",
          font: {
            family: "Inter, sans-serif",
            size: 11,
          },
          maxTicksLimit: 20, // Limit number of ticks for readability
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
        beginAtZero: true,
      },
    },
  };

  // Process visitor breakdown data for the bar chart
  const processVisitorChartData = () => {
    if (!dashboardStats?.visitorBreakdown) return null;

    const labels = dashboardStats.visitorBreakdown.map((item) => {
      const date = new Date(item.minute);
      return date.toLocaleTimeString([], {
        minute: "2-digit",
      });
    });

    const data = dashboardStats.visitorBreakdown.map(
      (item) => item.visitorCount
    );

    return {
      labels,
      datasets: [
        {
          label: "Visitors",
          data,
          backgroundColor: "rgba(99, 102, 241, 0.6)", // Indigo with transparency
          borderColor: "rgba(99, 102, 241, 1)", // Solid indigo border
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  };

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Failed to load dashboard data
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

  const chartData = processVisitorChartData();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="px-4 sm:px-0 py-4 sm:py-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          {t("welcomeBack", { username: user?.username || "" })}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("manageGalleryContent")}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Loading Chart */}
          <div className="lg:col-span-3 bg-card border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded mb-4 w-1/3"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      ) : dashboardStats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visitors Chart */}
          <div className="lg:col-span-3">
            <ChartCard
              title="Visitors by Minute"
              subtitle={`Last 30 minutes`}
              icon={BarChart3}
            >
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </ChartCard>
          </div>
        </div>
      ) : null}
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
