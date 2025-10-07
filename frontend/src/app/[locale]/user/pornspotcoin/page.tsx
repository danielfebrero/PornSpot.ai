"use client";

import { useState } from "react";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import {
  Sparkles,
  Zap,
  Crown,
  Infinity,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  User,
  TrendingUp,
  Loader2,
  Coins,
  Check,
  ArrowRight,
  Gem,
  Clock,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { usePSCDashboard } from "@/hooks/queries/usePSCQuery";
import { useTranslations } from "next-intl";
import { useUserContext } from "@/contexts/UserContext";
import { useLocaleRouter } from "@/lib/navigation";
import { useMutation } from "@tanstack/react-query";
import { pscApi } from "@/lib/api";
import { ApiUtil } from "@/lib/api-util";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { pscQueryUtils } from "@/hooks/queries/usePSCQuery";
import type { UserPlan } from "@/types/shared-types/permissions";
import type { PSCSpendRequest } from "@/types/shared-types/pornspotcoin";
import { cn } from "@/lib/utils";

type PlanKey = "starter" | "unlimited" | "pro" | "lifetime";

interface PlanFeature {
  text: string;
  highlight?: boolean;
}

interface Plan {
  id: PlanKey;
  name: string;
  description: string;
  features: PlanFeature[];
  badge?: string;
  price: number; // PSC price
  duration: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  bgGradient: string;
  popular: boolean;
}

const PLAN_CONFIGS: Record<
  PlanKey,
  Omit<Plan, "id" | "name" | "description" | "features" | "badge">
> = {
  starter: {
    price: 9,
    duration: "month",
    icon: Sparkles,
    color: "from-blue-500 to-cyan-500",
    borderColor: "border-blue-500/20",
    bgGradient: "from-blue-500/5 to-cyan-500/5",
    popular: false,
  },
  unlimited: {
    price: 18,
    duration: "month",
    icon: Zap,
    color: "from-purple-500 to-pink-500",
    borderColor: "border-purple-500/20",
    bgGradient: "from-purple-500/5 to-pink-500/5",
    popular: true,
  },
  pro: {
    price: 27,
    duration: "month",
    icon: Crown,
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/20",
    bgGradient: "from-orange-500/5 to-red-500/5",
    popular: false,
  },
  lifetime: {
    price: 1000,
    duration: "forever",
    icon: Infinity,
    color: "from-yellow-500 to-amber-500",
    borderColor: "border-yellow-500/20",
    bgGradient: "from-yellow-500/5 to-amber-500/5",
    popular: false,
  },
};

const RATE_ITEMS = [
  {
    icon: Eye,
    label: "page.view",
    key: "viewRate",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Heart,
    label: "page.like",
    key: "likeRate",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    icon: MessageCircle,
    label: "page.comment",
    key: "commentRate",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: Bookmark,
    label: "page.save",
    key: "bookmarkRate",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: User,
    label: "page.profile",
    key: "profileViewRate",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
];

export default function PornSpotCoinPage() {
  const t = useTranslations("pornspotcoin");
  const tPricing = useTranslations("pricing");
  const { user, refetch } = useUserContext();
  const router = useLocaleRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<PlanKey | null>(null);

  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

  const { data: dashboardData, isLoading } = usePSCDashboard();

  // Build plans with translations
  const PLANS: Plan[] = [
    {
      id: "starter",
      name: tPricing("planDetails.starter.name"),
      description: tPricing("planDetails.starter.description"),
      features: [{ text: tPricing("planDetails.starter.features.0") }],
      badge: undefined,
      ...PLAN_CONFIGS.starter,
    },
    {
      id: "unlimited",
      name: tPricing("planDetails.unlimited.name"),
      description: tPricing("planDetails.unlimited.description"),
      features: [
        { text: tPricing("planDetails.unlimited.features.0"), highlight: true },
        { text: tPricing("planDetails.unlimited.features.1") },
      ],
      badge: tPricing("planDetails.unlimited.badge"),
      ...PLAN_CONFIGS.unlimited,
    },
    {
      id: "pro",
      name: tPricing("planDetails.pro.name"),
      description: tPricing("planDetails.pro.description"),
      features: [
        { text: tPricing("planDetails.pro.features.0"), highlight: true },
        { text: tPricing("planDetails.pro.features.9"), highlight: true },
        { text: tPricing("planDetails.pro.features.1") },
        { text: tPricing("planDetails.pro.features.2") },
        { text: tPricing("planDetails.pro.features.3") },
        { text: tPricing("planDetails.pro.features.4") },
        { text: tPricing("planDetails.pro.features.5") },
        { text: tPricing("planDetails.pro.features.6") },
        { text: tPricing("planDetails.pro.features.7") },
        { text: tPricing("planDetails.pro.features.8") },
      ],
      badge: tPricing("planDetails.pro.badge"),
      ...PLAN_CONFIGS.pro,
    },
    {
      id: "lifetime",
      name: tPricing("planDetails.lifetime.name"),
      description: tPricing("planDetails.lifetime.description"),
      features: [
        { text: tPricing("planDetails.lifetime.features.0"), highlight: true },
        { text: tPricing("planDetails.lifetime.features.1"), highlight: true },
        { text: tPricing("planDetails.lifetime.features.2") },
        { text: tPricing("planDetails.lifetime.features.3") },
        { text: tPricing("planDetails.lifetime.features.4") },
      ],
      badge: tPricing("planDetails.lifetime.badge"),
      ...PLAN_CONFIGS.lifetime,
    },
  ];

  const spendMutation = useMutation({
    mutationFn: (payload: PSCSpendRequest) => pscApi.spend(payload),
  });

  const currentPlan = (user?.planInfo?.plan ?? "free") as UserPlan;
  const balance = dashboardData?.balance?.balance ?? 0;
  const rates = dashboardData?.rates;
  const recentTransactions = dashboardData?.recentTransactions || [];

  // Calculate daily stats from available data
  const todayEarned = recentTransactions
    .filter((tx) => {
      const txDate = new Date(tx.createdAt).toDateString();
      const today = new Date().toDateString();
      return txDate === today && tx.amount > 0;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const handlePurchase = async () => {
    if (!selectedPlan || !user) return;

    const plan = PLANS.find((p) => p.id === selectedPlan);
    if (!plan) return;

    const payload: PSCSpendRequest = {
      plan: selectedPlan,
      pscAmount: plan.price,
      metadata: {
        previousPlan: currentPlan,
      },
    };

    try {
      await spendMutation.mutateAsync(payload);
      await Promise.all([
        pscQueryUtils.invalidateBalance(),
        pscQueryUtils.invalidateDashboard(),
      ]);
      await refetch();

      setShowConfirm(false);
      router.push(`/payment/success?source=psc&reference=psc-${Date.now()}`);
    } catch (error) {
      const message = ApiUtil.handleApiError(error);
      setShowConfirm(false);
      router.push(
        `/payment/error?source=psc&message=${encodeURIComponent(message)}`
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalEarned = dashboardData?.balance?.totalEarned ?? 0;
  const totalSpent = dashboardData?.balance?.totalSpent ?? 0;

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Balance Card */}
        <div className="bg-background/95 backdrop-blur-xl border-b border-border/50">
          <div className="px-4 py-3 lg:py-6">
            <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20 hover:shadow-xl transition-shadow duration-300 max-w-7xl mx-auto">
              <div className="p-4 lg:p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="h-5 w-5 lg:h-6 lg:w-6 text-yellow-500" />
                      <span className="text-sm lg:text-base font-medium text-muted-foreground">
                        {t("page.yourBalance")}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 lg:gap-3">
                      <span className="text-3xl lg:text-5xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                        {balance.toFixed(2)}
                      </span>
                      <span className="text-sm lg:text-lg font-medium text-muted-foreground">
                        PSC
                      </span>
                    </div>
                    <p className="text-xs lg:text-sm text-muted-foreground mt-1 lg:mt-2">
                      ≈ ${((balance * 10) / 9).toFixed(2)} USD
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className="bg-green-500/10 text-green-600 border-green-500/30 mb-2 lg:mb-3 lg:text-sm"
                    >
                      <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                      {t("page.live")}
                    </Badge>
                    <p className="text-xs lg:text-sm text-muted-foreground">
                      {t("page.earnedToday")}
                    </p>
                    <p className="text-sm lg:text-xl font-bold text-green-600">
                      +{todayEarned.toFixed(2)} PSC
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Earning Rates Carousel */}
        <div className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("page.earnPscRates")}</h2>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Mobile: Horizontal scroll */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide lg:hidden">
            {RATE_ITEMS.map((item) => {
              const Icon = item.icon;
              const rate = rates?.[item.key as "viewRate"] || 0;

              return (
                <Card
                  key={item.key}
                  className="flex-shrink-0 min-w-[120px] border-border/50"
                >
                  <div className="p-3">
                    <div
                      className={`inline-flex p-2 rounded-lg ${item.bg} mb-2`}
                    >
                      <Icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t(item.label)}
                    </p>
                    <p className="font-bold">{rate.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("page.pscAction")}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Grid with space-between */}
          <div className="hidden lg:grid lg:grid-cols-5 gap-4">
            {RATE_ITEMS.map((item) => {
              const Icon = item.icon;
              const rate = rates?.[item.key as "viewRate"] || 0;

              return (
                <Card
                  key={item.key}
                  className="border-border/50 hover:shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <div className="p-4">
                    <div
                      className={`inline-flex p-3 rounded-xl ${item.bg} mb-3`}
                    >
                      <Icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t(item.label)}
                    </p>
                    <p className="text-xl font-bold">{rate.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("page.pscAction")}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Plans Section */}
        <div className="px-4 py-6">
          <div className="text-center mb-6 lg:mb-10">
            <h1 className="text-2xl lg:text-4xl font-bold mb-2 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              {t("page.upgradeWithPsc")}
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              {t("page.upgradeDescription")}
            </p>
          </div>

          {/* Mobile: Single column */}
          <div className="space-y-4 max-w-2xl mx-auto lg:hidden">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const canAfford = balance >= plan.price;
              const isCurrentPlan = currentPlan === plan.id;
              const isExpanded = expandedPlan === plan.id;
              const showAllFeatures = plan.features.length > 3;

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300",
                    canAfford && !isCurrentPlan ? "hover:shadow-lg" : "",
                    isCurrentPlan ? "ring-2 ring-primary" : "",
                    !canAfford ? "opacity-90" : "",
                    plan.popular ? "scale-[1.02]" : ""
                  )}
                >
                  {/* Gradient Header */}
                  <div className={cn("h-1.5 bg-gradient-to-r", plan.color)} />

                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    {plan.badge && (
                      <Badge
                        className={cn(
                          "text-xs border-0 bg-gradient-to-r text-white",
                          plan.color
                        )}
                      >
                        {plan.badge}
                      </Badge>
                    )}
                    {isCurrentPlan && (
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>

                  <div className={cn("p-4 bg-gradient-to-br", plan.bgGradient)}>
                    {/* Plan Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={cn(
                          "p-2.5 rounded-xl bg-gradient-to-br shadow-lg",
                          plan.color
                        )}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {plan.description}
                        </p>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-end justify-between mb-4 pb-4 border-b border-border/50">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">
                            {plan.price}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            PSC
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {plan.duration === "forever"
                            ? t("page.oneTime")
                            : t("page.perMonth", { duration: plan.duration })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {t("page.usdValue")}
                        </p>
                        <p className="text-lg font-semibold">
                          ${((plan.price * 10) / 9).toFixed(0)}
                        </p>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 mb-4">
                      {plan.features
                        .slice(0, isExpanded ? undefined : 3)
                        .map((feature, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div
                              className={cn(
                                "mt-0.5 rounded-full p-0.5 bg-green-500"
                              )}
                            >
                              <Check className="h-3 w-3 text-white" />
                            </div>
                            <span
                              className={cn(
                                "text-sm",
                                feature.highlight
                                  ? "font-medium"
                                  : "text-muted-foreground"
                              )}
                            >
                              {feature.text}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Show More Button */}
                    {showAllFeatures && !isExpanded && (
                      <button
                        onClick={() => setExpandedPlan(plan.id)}
                        className="text-xs text-primary hover:underline mb-3"
                      >
                        {t("page.moreFeatures", {
                          count: plan.features.length - 3,
                        })}
                      </button>
                    )}

                    {/* Action Button */}
                    <Button
                      className={cn(
                        "w-full",
                        canAfford && !isCurrentPlan
                          ? cn("bg-gradient-to-r text-white", plan.color)
                          : ""
                      )}
                      variant={
                        canAfford && !isCurrentPlan ? "default" : "outline"
                      }
                      disabled={
                        !canAfford || isCurrentPlan || spendMutation.isPending
                      }
                      onClick={() => {
                        if (canAfford && !isCurrentPlan) {
                          setSelectedPlan(plan.id);
                          setShowConfirm(true);
                        }
                      }}
                    >
                      {isCurrentPlan ? (
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          {t("page.yourCurrentPlan")}
                        </span>
                      ) : canAfford ? (
                        <span className="flex items-center gap-2">
                          {t("page.upgradeTo", { planName: plan.name })}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      ) : (
                        <span>
                          {t("page.needMorePsc", {
                            amount: (plan.price - balance).toFixed(0),
                          })}
                        </span>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop: 2-column grid */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const canAfford = balance >= plan.price;
              const isCurrentPlan = currentPlan === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300 group",
                    canAfford && !isCurrentPlan
                      ? "hover:shadow-2xl hover:scale-[1.02]"
                      : "",
                    isCurrentPlan ? "ring-2 ring-primary shadow-xl" : "",
                    !canAfford ? "opacity-75" : "",
                    plan.popular ? "shadow-lg" : ""
                  )}
                >
                  {/* Animated Gradient Header */}
                  <div
                    className={cn(
                      "h-2 bg-gradient-to-r transition-all duration-300",
                      plan.color,
                      canAfford && !isCurrentPlan ? "group-hover:h-3" : ""
                    )}
                  />

                  {/* Badges */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-10">
                    {plan.badge && (
                      <Badge
                        className={cn(
                          "text-xs font-semibold border-0 bg-gradient-to-r text-white shadow-lg",
                          plan.color
                        )}
                      >
                        ✨ {plan.badge}
                      </Badge>
                    )}
                    {isCurrentPlan && (
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold bg-primary/10 border-primary"
                      >
                        ✓ Current Plan
                      </Badge>
                    )}
                  </div>

                  <div className={cn("p-6 bg-gradient-to-br", plan.bgGradient)}>
                    {/* Plan Header */}
                    <div className="flex items-start gap-4 mb-6">
                      <div
                        className={cn(
                          "p-4 rounded-2xl bg-gradient-to-br shadow-xl transition-transform duration-300",
                          plan.color,
                          canAfford && !isCurrentPlan
                            ? "group-hover:scale-110 group-hover:rotate-6"
                            : ""
                        )}
                      >
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {plan.description}
                        </p>
                      </div>
                    </div>

                    {/* Pricing - Enhanced Desktop Layout */}
                    <div className="bg-card/50 rounded-xl p-5 mb-6 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span
                              className={cn(
                                "text-5xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                                plan.color
                              )}
                            >
                              {plan.price}
                            </span>
                            <span className="text-lg font-medium text-muted-foreground">
                              PSC
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">
                            {plan.duration === "forever"
                              ? t("page.oneTimePayment")
                              : t("page.perMonthSchedule", {
                                  duration: plan.duration,
                                })}
                          </p>
                        </div>
                        <div className="text-right bg-gradient-to-br from-green-500/10 to-emerald-500/10 px-4 py-3 rounded-lg border border-green-500/20">
                          <p className="text-xs text-muted-foreground font-medium mb-1">
                            💵 {t("page.usdValue")}
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            ${((plan.price * 10) / 9).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Features List - Always show all features on desktop */}
                    <div className="space-y-3 mb-6 min-h-[240px]">
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 group/feature"
                        >
                          <div
                            className={cn(
                              "mt-0.5 rounded-full p-1 bg-gradient-to-br from-green-500 to-emerald-500 shadow-md transition-transform duration-200 group-hover/feature:scale-110"
                            )}
                          >
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span
                            className={cn(
                              "text-sm leading-relaxed",
                              feature.highlight
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {feature.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action Button - Enhanced */}
                    <Button
                      className={cn(
                        "w-full h-12 text-base font-semibold transition-all duration-300",
                        canAfford && !isCurrentPlan
                          ? cn(
                              "bg-gradient-to-r text-white shadow-lg hover:shadow-2xl",
                              plan.color
                            )
                          : ""
                      )}
                      variant={
                        canAfford && !isCurrentPlan ? "default" : "outline"
                      }
                      disabled={
                        !canAfford || isCurrentPlan || spendMutation.isPending
                      }
                      onClick={() => {
                        if (canAfford && !isCurrentPlan) {
                          setSelectedPlan(plan.id);
                          setShowConfirm(true);
                        }
                      }}
                    >
                      {isCurrentPlan ? (
                        <span className="flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          {t("page.yourCurrentPlan")}
                        </span>
                      ) : canAfford ? (
                        <span className="flex items-center gap-2 group-hover:gap-3 transition-all">
                          {t("page.upgradeTo", { planName: plan.name })}
                          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          🔒{" "}
                          {t("page.needMorePsc", {
                            amount: (plan.price - balance).toFixed(0),
                          })}
                        </span>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-4 pb-8">
          <Card className="bg-card/50 hover:shadow-lg transition-shadow duration-300">
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="p-4 lg:p-6 text-center group hover:bg-purple-500/5 transition-colors duration-300">
                <Gem className="h-5 w-5 lg:h-6 lg:w-6 mx-auto mb-2 text-purple-500 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-xs lg:text-sm text-muted-foreground mb-1">
                  {t("page.totalEarned")}
                </p>
                <p className="text-lg lg:text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {totalEarned.toFixed(0)}
                </p>
                <p className="text-[10px] lg:text-xs text-muted-foreground mt-1">
                  {t("page.pscLifetime")}
                </p>
              </div>
              <div className="p-4 lg:p-6 text-center group hover:bg-green-500/5 transition-colors duration-300">
                <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 mx-auto mb-2 text-green-500 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-xs lg:text-sm text-muted-foreground mb-1">
                  {t("page.today")}
                </p>
                <p className="text-lg lg:text-2xl font-bold text-green-600">
                  +{todayEarned.toFixed(1)}
                </p>
                <p className="text-[10px] lg:text-xs text-muted-foreground mt-1">
                  {t("page.pscToday")}
                </p>
              </div>
              <div className="p-4 lg:p-6 text-center group hover:bg-orange-500/5 transition-colors duration-300">
                <Crown className="h-5 w-5 lg:h-6 lg:w-6 mx-auto mb-2 text-orange-500 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-xs lg:text-sm text-muted-foreground mb-1">
                  {t("page.totalSpent")}
                </p>
                <p className="text-lg lg:text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                  {totalSpent.toFixed(0)}
                </p>
                <p className="text-[10px] lg:text-xs text-muted-foreground mt-1">
                  {t("page.pscInvested")}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {selectedPlan && (
        <ConfirmDialog
          isOpen={showConfirm}
          onClose={() => {
            if (!spendMutation.isPending) {
              setShowConfirm(false);
              setSelectedPlan(null);
            }
          }}
          onConfirm={handlePurchase}
          title={t("page.confirmPurchaseTitle")}
          message={t("page.confirmPurchaseMessage", {
            planName: PLANS.find((p) => p.id === selectedPlan)?.name || "",
            price: PLANS.find((p) => p.id === selectedPlan)?.price || 0,
          })}
          confirmText={t("page.completePurchase")}
          loading={spendMutation.isPending}
        />
      )}
    </>
  );
}
