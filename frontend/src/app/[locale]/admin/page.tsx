"use client";

import { useAdminContext } from "@/contexts/AdminContext";
import { useTranslations } from "next-intl";
import { useAdminDashboardStatsQuery } from "@/hooks/queries/useAdminAnalyticsQuery";
import { RefreshCw, Users, Clock } from "lucide-react";

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

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Loading Cards */}
          <div className="bg-card border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded mb-4 w-1/3"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded mb-4 w-1/3"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ) : dashboardStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Visitors Last 5 Minutes Card */}
          <VisitorCard
            title="Visitors (Last 5 minutes)"
            count={dashboardStats.visitorCounts.visitorsLast5Minutes}
            icon={Clock}
            timeframe="5min"
          />

          {/* Visitors Last 30 Minutes Card */}
          <VisitorCard
            title="Visitors (Last 30 minutes)"
            count={dashboardStats.visitorCounts.visitorsLast30Minutes}
            icon={Users}
            timeframe="30min"
          />
        </div>
      ) : null}
    </div>
  );
}

// Visitor Card Component
interface VisitorCardProps {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  timeframe: string;
}

function VisitorCard({
  title,
  count,
  icon: Icon,
  timeframe,
}: VisitorCardProps) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {title}
            </h3>
            <p className="text-2xl font-bold text-foreground">{count}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {timeframe}
        </div>
      </div>
    </div>
  );
}
