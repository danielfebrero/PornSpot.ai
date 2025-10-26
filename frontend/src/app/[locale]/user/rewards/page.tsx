"use client";

import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Trophy,
  Zap,
  Crown,
  Gift,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

// Milestone configuration
const MILESTONES = [
  {
    day: 7,
    rewards: {
      free: { type: "images", amount: 10, unit: "credits" },
      starter: { type: "images", amount: 10, unit: "credits" },
      unlimited: { type: "video", amount: 5, unit: "seconds" },
      pro: { type: "video", amount: 10, unit: "seconds" },
    },
  },
  {
    day: 30,
    rewards: {
      free: { type: "images", amount: 50, unit: "credits" },
      starter: { type: "images", amount: 50, unit: "credits" },
      unlimited: { type: "video", amount: 25, unit: "seconds" },
      pro: { type: "video", amount: 50, unit: "seconds" },
    },
  },
  {
    day: 90,
    rewards: {
      free: { type: "images", amount: 500, unit: "credits" },
      starter: { type: "images", amount: 500, unit: "credits" },
      unlimited: { type: "video", amount: 100, unit: "seconds" },
      pro: { type: "video", amount: 200, unit: "seconds" },
    },
  },
];

const RewardsPage: React.FC = () => {
  const t = useTranslations("user.rewards");
  const { user } = useUserContext();

  // Set document title and meta description
  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

  // Get current streak from user data
  const currentStreak = user?.usageStats?.daysStreakGeneration || 0;

  // Determine user plan for reward display
  const userPlan = user?.planInfo?.plan || "free";

  // Calculate progress percentage for each milestone
  const getProgressPercentage = (milestoneDay: number) => {
    return Math.min((currentStreak / milestoneDay) * 100, 100);
  };

  // Check if milestone is reached
  const isMilestoneReached = (milestoneDay: number) => {
    return currentStreak >= milestoneDay;
  };

  // Get reward for user's current plan
  const getRewardForPlan = (milestone: (typeof MILESTONES)[0]) => {
    const planKey = userPlan as keyof typeof milestone.rewards;
    return milestone.rewards[planKey] || milestone.rewards.free;
  };

  // Get milestone icon based on day
  const getMilestoneIcon = (day: number) => {
    switch (day) {
      case 7:
        return Gift;
      case 30:
        return Sparkles;
      case 90:
        return Crown;
      default:
        return Trophy;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Current Streak Display */}
      <Card className="mb-8 p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {t("currentStreak")}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-yellow-500">
                {currentStreak}
              </span>
              <span className="text-2xl text-muted-foreground">
                {t("days", { count: currentStreak })}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Calendar className="h-12 w-12 text-yellow-500" />
            <Zap className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </Card>

      {/* Progress Bar with Milestones */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-6">{t("milestones.title")}</h2>

        {/* Progress Bar */}
        <div className="relative mb-16">
          {/* Background track */}
          <div className="absolute top-1/2 left-0 right-0 h-2 bg-muted rounded-full transform -translate-y-1/2" />

          {/* Active progress */}
          <div
            className="absolute top-1/2 left-0 h-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transform -translate-y-1/2 transition-all duration-500"
            style={{
              width: `${Math.min((currentStreak / 90) * 100, 100)}%`,
            }}
          />

          {/* Milestone markers */}
          <div className="relative flex justify-between">
            {MILESTONES.map((milestone) => {
              const Icon = getMilestoneIcon(milestone.day);
              const isReached = isMilestoneReached(milestone.day);
              const progress = getProgressPercentage(milestone.day);

              return (
                <div
                  key={milestone.day}
                  className="flex flex-col items-center"
                  style={{ width: `${100 / MILESTONES.length}%` }}
                >
                  {/* Milestone marker */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all duration-300 relative z-10",
                      isReached
                        ? "bg-gradient-to-br from-yellow-500 to-orange-500 border-yellow-400 shadow-lg shadow-yellow-500/50"
                        : "bg-background border-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        isReached ? "text-white" : "text-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Day label */}
                  <p
                    className={cn(
                      "mt-2 text-sm font-medium",
                      isReached ? "text-yellow-500" : "text-muted-foreground"
                    )}
                  >
                    {t("day", { day: milestone.day })}
                  </p>

                  {/* Status badge - always rendered to maintain consistent spacing */}
                  <div className="mt-1 h-6 flex items-center justify-center">
                    {isReached && (
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                        {t("milestones.completed")}
                      </Badge>
                    )}
                    {!isReached && progress > 0 && (
                      <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                        {Math.round(progress)}%
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Milestone Rewards Details */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">{t("rewards.title")}</h2>

        <div className="grid gap-6 md:grid-cols-3">
          {MILESTONES.map((milestone) => {
            const Icon = getMilestoneIcon(milestone.day);
            const isReached = isMilestoneReached(milestone.day);
            const reward = getRewardForPlan(milestone);
            const RewardIcon = reward.type === "images" ? ImageIcon : Video;

            return (
              <Card
                key={milestone.day}
                className={cn(
                  "p-6 transition-all duration-300",
                  isReached
                    ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 shadow-lg"
                    : "opacity-75 hover:opacity-100"
                )}
              >
                {/* Card header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        isReached ? "text-yellow-500" : "text-muted-foreground"
                      )}
                    />
                    <h3 className="font-semibold">
                      {t("rewards.milestone", { day: milestone.day })}
                    </h3>
                  </div>
                  {isReached && (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                      {t("rewards.claimed")}
                    </Badge>
                  )}
                </div>

                {/* Reward description */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg border border-border/50">
                    <RewardIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-lg">
                        {reward.amount}{" "}
                        {reward.type === "images"
                          ? t("rewards.imageCredits")
                          : t("rewards.videoSeconds")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`rewards.planType.${userPlan}`)}
                      </p>
                    </div>
                  </div>

                  {/* Show all plan rewards */}
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">
                      {t("rewards.allPlans")}:
                    </p>
                    <div className="space-y-1 text-xs">
                      {Object.entries(milestone.rewards).map(
                        ([plan, planReward]) => (
                          <div
                            key={plan}
                            className="flex justify-between text-muted-foreground"
                          >
                            <span className="capitalize">{plan}:</span>
                            <span>
                              {planReward.amount}{" "}
                              {planReward.type === "images"
                                ? t("rewards.images")
                                : t("rewards.videoSec")}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info section */}
      <Card className="mt-8 p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold mb-2">{t("info.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("info.description")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RewardsPage;
