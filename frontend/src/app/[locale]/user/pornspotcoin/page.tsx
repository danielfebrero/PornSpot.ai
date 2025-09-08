"use client";

import { useState } from "react";
import {
  Coins,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  User,
  Calendar,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

// Mock data for PSC dashboard
const mockPSCData = {
  balance: {
    current: 127.845,
    totalEarned: 892.156,
    totalSpent: 764.311,
    globalRank: 127, // Rank among all earners since beginning
  },
  dailyStats: {
    todayEarned: 5.23,
    yesterdayEarned: 7.89,
    averageDaily: 6.12,
    streak: 15, // consecutive earning days
  },
  currentRates: {
    viewRate: 0.0012,
    likeRate: 0.0045,
    commentRate: 0.0078,
    bookmarkRate: 0.0034,
    profileViewRate: 0.0019,
  },
  exchangeRates: {
    starter: { duration: "1 month", cost: 9 },
    unlimited: { duration: "1 month", cost: 18 },
    pro: { duration: "1 month", cost: 27 },
    lifetime: { duration: "Lifetime", cost: 1000 },
  },
  weeklyPayoutRates: generateMockWeeklyData(),
  recentTransactions: [
    {
      id: "1",
      type: "reward_like",
      amount: 0.0045,
      timestamp: new Date().toISOString(),
      description: "Like reward",
    },
    {
      id: "2",
      type: "reward_view",
      amount: 0.0012,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      description: "View reward",
    },
    {
      id: "3",
      type: "reward_comment",
      amount: 0.0078,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      description: "Comment reward",
    },
  ],
  performance: {
    weeklyTotalInteractions: 2847,
    weeklyTotalViews: 1853,
    weeklyPayoutGrowth: 12.5, // percentage growth in PSC earned this week vs last week
  },
};

// Generate mock data for 24x7 (168 points) over one week
function generateMockWeeklyData() {
  const data = [];
  const actions = [
    "view",
    "like",
    "comment",
    "bookmark",
    "profileView",
  ] as const;
  const baseRates: Record<string, number> = {
    view: 0.0012,
    like: 0.0045,
    comment: 0.0078,
    bookmark: 0.0034,
    profileView: 0.0019,
  };

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date();
      timestamp.setDate(timestamp.getDate() - (6 - day));
      timestamp.setHours(hour, 0, 0, 0);

      const point = {
        timestamp: timestamp.toISOString(),
        day: day,
        hour: hour,
        rates: {} as Record<string, number>,
      };

      // Simulate activity patterns and budget effects
      const activityMultiplier = getActivityMultiplier(day, hour);
      const budgetFactor = getBudgetFactor(hour);

      actions.forEach((action) => {
        // Base rate adjusted by activity and budget availability
        point.rates[action] =
          baseRates[action] *
          activityMultiplier *
          budgetFactor *
          (0.8 + Math.random() * 0.4); // Add some randomness
      });

      data.push(point);
    }
  }

  return data;
}

function getActivityMultiplier(day: number, hour: number): number {
  // Simulate higher activity on weekends and during peak hours
  const isWeekend = day === 0 || day === 6;
  const isPeakTime = hour >= 19 && hour <= 23; // 7 PM to 11 PM
  const isLateNight = hour >= 0 && hour <= 2; // Midnight to 2 AM

  let multiplier = 1;
  if (isWeekend) multiplier *= 1.3;
  if (isPeakTime) multiplier *= 1.5;
  if (isLateNight) multiplier *= 0.7;

  return multiplier;
}

function getBudgetFactor(hour: number): number {
  // Simulate budget depletion throughout the day
  // Higher rates early in the day when budget is full
  return Math.max(0.3, 1.2 - (hour / 24) * 0.9);
}

export default function PornSpotCoinPage() {
  const [selectedChart, setSelectedChart] = useState("rates");

  // Calculate trends
  const balanceTrend =
    ((mockPSCData.dailyStats.todayEarned -
      mockPSCData.dailyStats.yesterdayEarned) /
      mockPSCData.dailyStats.yesterdayEarned) *
    100;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8 text-yellow-500" />
            PornSpotCoin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your PSC earnings, payout rates, and exchange opportunities
          </p>
        </div>
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Activity className="h-3 w-3 mr-1" />
          Live Data
        </Badge>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Current Balance
              </h3>
              <Coins className="h-4 w-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-yellow-600">
                {mockPSCData.balance.current.toFixed(3)} PSC
              </div>
              <div className="text-sm text-muted-foreground">
                ${(mockPSCData.balance.current * 0.95).toFixed(2)} USD
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Total Earned
              </h3>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {mockPSCData.balance.totalEarned.toFixed(3)} PSC
              </div>
              <div className="flex items-center text-sm text-green-600">
                <ArrowUpRight className="h-3 w-3 mr-1" />+
                {balanceTrend.toFixed(1)}% vs yesterday
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Today&apos;s Earnings
              </h3>
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {mockPSCData.dailyStats.todayEarned.toFixed(3)} PSC
              </div>
              <div className="text-sm text-muted-foreground">
                {mockPSCData.dailyStats.streak} day streak
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Global Rank
              </h3>
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-yellow-600">
                #{mockPSCData.balance.globalRank}
              </div>
              <div className="text-sm text-muted-foreground">
                All-time earners
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Payout Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Live Payout Rates</h3>
              <p className="text-sm text-muted-foreground">
                Current PSC rewards per action (updates every hour)
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              {
                icon: Eye,
                label: "Views",
                rate: mockPSCData.currentRates.viewRate,
                bgClass:
                  "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
                iconClass: "text-blue-600",
                textClass: "text-blue-700 dark:text-blue-300",
              },
              {
                icon: Heart,
                label: "Likes",
                rate: mockPSCData.currentRates.likeRate,
                bgClass:
                  "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
                iconClass: "text-red-600",
                textClass: "text-red-700 dark:text-red-300",
              },
              {
                icon: MessageCircle,
                label: "Comments",
                rate: mockPSCData.currentRates.commentRate,
                bgClass:
                  "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
                iconClass: "text-green-600",
                textClass: "text-green-700 dark:text-green-300",
              },
              {
                icon: Bookmark,
                label: "Bookmarks",
                rate: mockPSCData.currentRates.bookmarkRate,
                bgClass:
                  "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800",
                iconClass: "text-purple-600",
                textClass: "text-purple-700 dark:text-purple-300",
              },
              {
                icon: User,
                label: "Profile Views",
                rate: mockPSCData.currentRates.profileViewRate,
                bgClass:
                  "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
                iconClass: "text-orange-600",
                textClass: "text-orange-700 dark:text-orange-300",
              },
            ].map((item, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${item.bgClass}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={`h-4 w-4 ${item.iconClass}`} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <div className={`text-lg font-bold ${item.textClass}`}>
                  {item.rate.toFixed(4)} PSC
                </div>
                <div className="text-xs text-muted-foreground">per action</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Payout Rates Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">
                Weekly Payout Rate Trends
              </h3>
              <p className="text-sm text-muted-foreground">
                24x7 granular view of payout rates over the last week (168 data
                points)
              </p>
            </div>
            <div className="flex gap-2">
              {["rates", "volume"].map((chart) => (
                <Button
                  key={chart}
                  variant={selectedChart === chart ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedChart(chart)}
                >
                  {chart === "rates" ? "Rates" : "Volume"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
            <div className="text-center space-y-2">
              <PieChart className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="text-lg font-medium">
                Interactive Chart Placeholder
              </div>
              <div className="text-sm text-muted-foreground max-w-md">
                This would contain a dynamic chart showing payout rates for each
                action type over 168 data points (24 hours × 7 days). Each point
                represents hourly rates influenced by activity volume and daily
                budget distribution.
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Views</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span>Bookmarks</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">PSC Exchange Rates</h3>
              <p className="text-sm text-muted-foreground">
                Current exchange rates for premium subscriptions
              </p>
            </div>
            <DollarSign className="h-5 w-5 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(mockPSCData.exchangeRates).map(
              ([plan, details]) => {
                const canAfford = mockPSCData.balance.current >= details.cost;
                return (
                  <div
                    key={plan}
                    className={`p-4 border rounded-lg transition-colors ${
                      canAfford
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold capitalize">{plan}</h4>
                        {canAfford && (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-600"
                          >
                            Affordable
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-yellow-600">
                        {details.cost} PSC
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {details.duration}
                      </div>
                      <Button
                        size="sm"
                        variant={canAfford ? "default" : "outline"}
                        disabled={!canAfford}
                        className="w-full"
                      >
                        {canAfford ? "Purchase" : "Insufficient PSC"}
                      </Button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Performance Insights</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Weekly Total Interactions
                </span>
                <span className="font-semibold">
                  {mockPSCData.performance.weeklyTotalInteractions.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Weekly Total Views
                </span>
                <span className="font-semibold">
                  {mockPSCData.performance.weeklyTotalViews.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Weekly Payout Growth
                </span>
                <span className="font-semibold text-green-600">
                  +{mockPSCData.performance.weeklyPayoutGrowth}%
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="space-y-2">
                <h4 className="font-medium">Earning Tips</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    • Post content during low activity hours for higher payout
                    rates
                  </li>
                  <li>• Engage early in the day when daily budgets are full</li>
                  <li>• Quality content gets more engagement and rewards</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Transactions</h3>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockPSCData.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      {tx.type.includes("like") && (
                        <Heart className="h-3 w-3 text-green-600" />
                      )}
                      {tx.type.includes("view") && (
                        <Eye className="h-3 w-3 text-green-600" />
                      )}
                      {tx.type.includes("comment") && (
                        <MessageCircle className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {tx.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-green-600">
                    +{tx.amount.toFixed(4)} PSC
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
