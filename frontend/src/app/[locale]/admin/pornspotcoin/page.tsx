"use client";

import { useState } from "react";
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

export default function PSCAdminPage() {
  // const t = useTranslations("admin.pornspotcoin");
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock data - will be replaced with actual API calls
  const mockOverviewData = {
    dailyBudget: {
      total: 33.0,
      remaining: 18.5,
      distributed: 14.5,
      activity: {
        views: 245,
        likes: 67,
        comments: 23,
        bookmarks: 34,
        profileViews: 12,
      },
    },
    currentRates: {
      viewRate: 0.035,
      likeRate: 0.21,
      commentRate: 0.35,
      bookmarkRate: 0.28,
      profileViewRate: 0.14,
    },
    systemConfig: {
      enableRewards: true,
      enableUserToUserTransfers: true,
      enableWithdrawals: false,
      dailyBudgetAmount: 33.0,
      minimumPayoutAmount: 0.000000001,
      maxPayoutPerAction: 1000,
      rateWeights: {
        view: 1,
        like: 6,
        comment: 10,
        bookmark: 8,
        profileView: 4,
      },
    },
    recentStats: {
      totalDistributedToday: 14.5,
      totalTransactionsToday: 381,
      activeUsersEarning: 45,
      averageEarningsPerUser: 0.32,
    },
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // TODO: Implement actual refresh logic
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

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
          value={`${mockOverviewData.dailyBudget.remaining.toFixed(2)} PSC`}
          subtitle={`of ${mockOverviewData.dailyBudget.total} PSC`}
          icon={DollarSign}
          trend={
            +(
              (mockOverviewData.dailyBudget.distributed /
                mockOverviewData.dailyBudget.total) *
              100
            )
          }
          trendLabel={`${Math.round(
            (mockOverviewData.dailyBudget.distributed /
              mockOverviewData.dailyBudget.total) *
              100
          )}% distributed`}
        />

        <StatusCard
          title="Total Transactions"
          value={mockOverviewData.recentStats.totalTransactionsToday.toString()}
          subtitle="Today"
          icon={Activity}
          trend={+12}
          trendLabel="+12% vs yesterday"
        />

        <StatusCard
          title="Active Earners"
          value={mockOverviewData.recentStats.activeUsersEarning.toString()}
          subtitle="Users"
          icon={Users}
          trend={+8}
          trendLabel="+8% vs yesterday"
        />

        <StatusCard
          title="Average Earnings"
          value={`${mockOverviewData.recentStats.averageEarningsPerUser.toFixed(
            3
          )} PSC`}
          subtitle="Per User"
          icon={TrendingUp}
          trend={-3}
          trendLabel="-3% vs yesterday"
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
              rate={mockOverviewData.currentRates.viewRate}
              weight={mockOverviewData.systemConfig.rateWeights.view}
            />
            <RateDisplay
              label="Like"
              rate={mockOverviewData.currentRates.likeRate}
              weight={mockOverviewData.systemConfig.rateWeights.like}
            />
            <RateDisplay
              label="Comment"
              rate={mockOverviewData.currentRates.commentRate}
              weight={mockOverviewData.systemConfig.rateWeights.comment}
            />
            <RateDisplay
              label="Bookmark"
              rate={mockOverviewData.currentRates.bookmarkRate}
              weight={mockOverviewData.systemConfig.rateWeights.bookmark}
            />
            <RateDisplay
              label="Profile View"
              rate={mockOverviewData.currentRates.profileViewRate}
              weight={mockOverviewData.systemConfig.rateWeights.profileView}
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
              value={mockOverviewData.systemConfig.enableRewards}
              type="boolean"
            />
            <SystemStatusItem
              label="Transfers Enabled"
              value={mockOverviewData.systemConfig.enableUserToUserTransfers}
              type="boolean"
            />
            <SystemStatusItem
              label="Withdrawals Enabled"
              value={mockOverviewData.systemConfig.enableWithdrawals}
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
                  count={mockOverviewData.dailyBudget.activity.views}
                />
                <ActivityStat
                  label="Likes"
                  count={mockOverviewData.dailyBudget.activity.likes}
                />
                <ActivityStat
                  label="Comments"
                  count={mockOverviewData.dailyBudget.activity.comments}
                />
                <ActivityStat
                  label="Bookmarks"
                  count={mockOverviewData.dailyBudget.activity.bookmarks}
                />
                <ActivityStat
                  label="Profile Views"
                  count={mockOverviewData.dailyBudget.activity.profileViews}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "configuration" && (
          <SectionErrorBoundary context="PSC System Configuration">
            <PSCSystemConfigSection config={mockOverviewData.systemConfig} />
          </SectionErrorBoundary>
        )}

        {activeTab === "budgets" && (
          <SectionErrorBoundary context="PSC Daily Budget Management">
            <PSCDailyBudgetSection />
          </SectionErrorBoundary>
        )}

        {activeTab === "transactions" && (
          <SectionErrorBoundary context="PSC Transaction History">
            <PSCTransactionHistorySection />
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

// Placeholder components for sections
function PSCSystemConfigSection({ config }: { config: any }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">System Configuration</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            PSC system configuration management will be implemented here.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Daily Budget Amount</label>
              <p className="text-lg font-semibold">
                {config.dailyBudgetAmount} PSC
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                Maximum Payout per Action
              </label>
              <p className="text-lg font-semibold">
                {config.maxPayoutPerAction} PSC
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PSCDailyBudgetSection() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Daily Budget Management</h3>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Daily budget management interface will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}

function PSCTransactionHistorySection() {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Transaction History</h3>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Transaction history and filtering interface will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
