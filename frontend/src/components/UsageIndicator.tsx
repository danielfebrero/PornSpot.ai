"use client";

import { useUserPermissions } from "@/hooks/useUserPermissions";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

interface UsageIndicatorProps {
  type: "daily" | "monthly";
  compact?: boolean;
  showText?: boolean;
}

export function UsageIndicator({
  type,
  compact = false,
  showText = true,
}: UsageIndicatorProps) {
  const { user, getPlanLimits, formatUsageText, getUsagePercentage } =
    useUserPermissions();
  const t = useTranslations("usage");

  if (!user) return null;

  const limits = getPlanLimits();
  if (!limits) return null;

  const { usageStats } = user;
  const isMonthly = type === "monthly";

  const used = isMonthly
    ? usageStats.imagesGeneratedThisMonth
    : usageStats.imagesGeneratedToday;
  const limit = isMonthly ? limits.imagesPerMonth : limits.imagesPerDay;
  const period = isMonthly ? t("thisMonth") : t("today");

  const percentage = getUsagePercentage(used, limit);
  const isUnlimited = limit === "unlimited";

  // Color based on usage percentage
  const getColor = () => {
    if (isUnlimited) return "text-green-600 bg-green-100";
    if (percentage >= 90) return "text-red-600 bg-red-100";
    if (percentage >= 70) return "text-amber-600 bg-amber-100";
    return "text-blue-600 bg-blue-100";
  };

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getColor()}`}
      >
        <BarChart3 className="h-3 w-3" />
        <span>
          {used}
          {!isUnlimited && `/${limit}`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showText && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t("imagesGenerated", { period })}
          </span>
          <span className="font-medium">
            {formatUsageText(used, limit, "images")}
          </span>
        </div>
      )}

      {!isUnlimited && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              percentage >= 90
                ? "bg-red-500"
                : percentage >= 70
                ? "bg-amber-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}

      {isUnlimited && showText && (
        <div className="text-xs text-green-600 dark:text-green-400">
          {t("unlimitedUsage")}
        </div>
      )}
    </div>
  );
}

// Quick usage stats component for headers/sidebars
export function QuickUsageStats() {
  const { user, getCurrentPlan } = useUserPermissions();
  const t = useTranslations("usage");

  if (!user) return null;

  const plan = getCurrentPlan();

  return (
    <div className="bg-card border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("usage")}</span>
        <span className="text-xs text-muted-foreground capitalize">
          {t("plan", { plan })}
        </span>
      </div>

      <div className="space-y-1">
        <UsageIndicator type="daily" compact={false} showText={false} />
        <div className="text-xs text-muted-foreground">
          {t("dailyLimitText")}
        </div>
      </div>

      <div className="space-y-1">
        <UsageIndicator type="monthly" compact={false} showText={false} />
        <div className="text-xs text-muted-foreground">
          {t("monthlyLimitText")}
        </div>
      </div>
    </div>
  );
}
