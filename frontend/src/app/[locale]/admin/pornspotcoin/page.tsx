"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  TrendingUp,
  DollarSign,
  Activity,
  Users,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionErrorBoundary } from "@/components/ErrorBoundaries";
import { PSCConfigurationManager } from "@/components/admin/pornspotcoin/PSCConfigurationManager";
import { DailyBudgetManager } from "@/components/admin/pornspotcoin/DailyBudgetManager";
import { TransactionHistory } from "@/components/admin/pornspotcoin/TransactionHistory";
import { adminPSCApi, PSCOverviewData } from "@/lib/api/admin-psc";

export default function PSCAdminPage() {
  // const t = useTranslations("admin.pornspotcoin");
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [overviewData, setOverviewData] = useState<PSCOverviewData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load overview data on component mount
  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminPSCApi.getOverview();
      setOverviewData(data);
    } catch (err) {
      console.error("Failed to load PSC overview data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadOverviewData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              PornSpotCoin Management
            </h1>
            <p className="text-muted-foreground mt-1">Loading PSC data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !overviewData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              PornSpotCoin Management
            </h1>
            <p className="text-red-500 mt-1">
              {error || "Failed to load PSC data"}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            PornSpotCoin Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage PSC system configuration, budgets, and transactions
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Daily Budget Remaining"
          value={`${overviewData.dailyBudget.remaining.toFixed(2)} PSC`}
          subtitle={`of ${overviewData.dailyBudget.total} PSC`}
          icon={DollarSign}
          trend={
            +(
              (overviewData.dailyBudget.distributed /
                overviewData.dailyBudget.total) *
              100
            )
          }
          trendLabel={`${Math.round(
            (overviewData.dailyBudget.distributed /
              overviewData.dailyBudget.total) *
              100
          )}% distributed`}
        />

        <StatusCard
          title="Total Transactions"
          value="N/A"
          subtitle="Today"
          icon={Activity}
          trend={0}
          trendLabel="See transactions tab"
        />

        <StatusCard
          title="Active Earners"
          value="N/A"
          subtitle="Users"
          icon={Users}
          trend={0}
          trendLabel="Data coming soon"
        />

        <StatusCard
          title="Current Budget"
          value={`${overviewData.dailyBudget.total.toFixed(2)} PSC`}
          subtitle="Daily Total"
          icon={TrendingUp}
          trend={0}
          trendLabel="Per day"
        />
      </div>

      {/* Current Rates Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Current PSC Rates</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <RateDisplay
              label="View"
              rate={overviewData.currentRates.viewRate}
              weight={overviewData.systemConfig.rateWeights.view}
            />
            <RateDisplay
              label="Like"
              rate={overviewData.currentRates.likeRate}
              weight={overviewData.systemConfig.rateWeights.like}
            />
            <RateDisplay
              label="Comment"
              rate={overviewData.currentRates.commentRate}
              weight={overviewData.systemConfig.rateWeights.comment}
            />
            <RateDisplay
              label="Bookmark"
              rate={overviewData.currentRates.bookmarkRate}
              weight={overviewData.systemConfig.rateWeights.bookmark}
            />
            <RateDisplay
              label="Profile View"
              rate={overviewData.currentRates.profileViewRate}
              weight={overviewData.systemConfig.rateWeights.profileView}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h3 className="text-lg font-semibold">System Status</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SystemStatusItem
              label="Rewards Enabled"
              value={overviewData.systemConfig.enableRewards}
              type="boolean"
            />
            <SystemStatusItem
              label="Transfers Enabled"
              value={overviewData.systemConfig.enableUserToUserTransfers}
              type="boolean"
            />
            <SystemStatusItem
              label="Withdrawals Enabled"
              value={overviewData.systemConfig.enableWithdrawals}
              type="boolean"
            />
          </div>
        </CardContent>
      </Card>

      {/* Management Tabs */}
      <div className="space-y-4">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </TabButton>
          <TabButton
            active={activeTab === "configuration"}
            onClick={() => setActiveTab("configuration")}
          >
            Configuration
          </TabButton>
          <TabButton
            active={activeTab === "budgets"}
            onClick={() => setActiveTab("budgets")}
          >
            Daily Budgets
          </TabButton>
          <TabButton
            active={activeTab === "transactions"}
            onClick={() => setActiveTab("transactions")}
          >
            Transactions
          </TabButton>
        </div>

        {activeTab === "overview" && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Today&apos;s Activity</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ActivityStat
                  label="Views"
                  count={overviewData.dailyBudget.activity.views}
                />
                <ActivityStat
                  label="Likes"
                  count={overviewData.dailyBudget.activity.likes}
                />
                <ActivityStat
                  label="Comments"
                  count={overviewData.dailyBudget.activity.comments}
                />
                <ActivityStat
                  label="Bookmarks"
                  count={overviewData.dailyBudget.activity.bookmarks}
                />
                <ActivityStat
                  label="Profile Views"
                  count={overviewData.dailyBudget.activity.profileViews}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "configuration" && (
          <SectionErrorBoundary context="PSC System Configuration">
            <PSCConfigurationManager />
          </SectionErrorBoundary>
        )}

        {activeTab === "budgets" && (
          <SectionErrorBoundary context="PSC Daily Budget Management">
            <DailyBudgetManager />
          </SectionErrorBoundary>
        )}

        {activeTab === "transactions" && (
          <SectionErrorBoundary context="PSC Transaction History">
            <TransactionHistory />
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}

// Component for status cards with trends
interface StatusCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  trend: number;
  trendLabel: string;
}

function StatusCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
}: StatusCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <div className="flex items-center space-x-1">
            <span
              className={`text-xs ${
                trend >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend >= 0 ? "↗" : "↘"} {trendLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component for rate display
interface RateDisplayProps {
  label: string;
  rate: number;
  weight: number;
}

function RateDisplay({ label, rate, weight }: RateDisplayProps) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-lg font-bold text-primary">{rate.toFixed(4)} PSC</p>
      <p className="text-xs text-muted-foreground">Weight: {weight}x</p>
    </div>
  );
}

// Component for system status items
interface SystemStatusItemProps {
  label: string;
  value: boolean | string | number;
  type: "boolean" | "string" | "number";
}

function SystemStatusItem({ label, value, type }: SystemStatusItemProps) {
  const renderValue = () => {
    if (type === "boolean") {
      return (
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              value ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className={value ? "text-green-600" : "text-red-600"}>
            {value ? "Enabled" : "Disabled"}
          </span>
        </div>
      );
    }
    return <span className="text-foreground">{String(value)}</span>;
  };

  return (
    <div className="flex flex-col space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {renderValue()}
    </div>
  );
}

// Component for activity statistics
interface ActivityStatProps {
  label: string;
  count: number;
}

function ActivityStat({ label, count }: ActivityStatProps) {
  return (
    <div className="text-center p-3 bg-muted/30 rounded-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">
        {count.toLocaleString()}
      </p>
    </div>
  );
}

// Simple tab button component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
