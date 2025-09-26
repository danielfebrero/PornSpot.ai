"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Slider";
import { Check, Star, Zap, Crown, Loader2, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useUserContext } from "@/contexts/UserContext";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useLocaleRouter } from "@/lib/navigation";
import { finbyApi } from "@/lib/api/finby";

// Payment provider logos
const MastercardLogo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 -11 70 70"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="69"
      height="47"
      rx="5.5"
      fill="white"
      stroke="#D9D9D9"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M35.3945 34.7619C33.0114 36.8184 29.92 38.0599 26.5421 38.0599C19.0047 38.0599 12.8945 31.8788 12.8945 24.254C12.8945 16.6291 19.0047 10.448 26.5421 10.448C29.92 10.448 33.0114 11.6895 35.3945 13.7461C37.7777 11.6895 40.869 10.448 44.247 10.448C51.7843 10.448 57.8945 16.6291 57.8945 24.254C57.8945 31.8788 51.7843 38.0599 44.247 38.0599C40.869 38.0599 37.7777 36.8184 35.3945 34.7619Z"
      fill="#ED0006"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M35.3945 34.7619C38.3289 32.2296 40.1896 28.4616 40.1896 24.254C40.1896 20.0463 38.3289 16.2783 35.3945 13.7461C37.7777 11.6895 40.869 10.448 44.247 10.448C51.7843 10.448 57.8945 16.6291 57.8945 24.254C57.8945 31.8788 51.7843 38.0599 44.247 38.0599C40.869 38.0599 37.7777 36.8184 35.3945 34.7619Z"
      fill="#F9A000"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M35.3946 13.7461C38.329 16.2784 40.1897 20.0463 40.1897 24.254C40.1897 28.4616 38.329 32.2295 35.3946 34.7618C32.4603 32.2295 30.5996 28.4616 30.5996 24.254C30.5996 20.0463 32.4603 16.2784 35.3946 13.7461Z"
      fill="#FF5E00"
    />
  </svg>
);

const VisaLogo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 -11 70 70"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="69"
      height="47"
      rx="5.5"
      fill="white"
      stroke="#D9D9D9"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M21.2505 32.5165H17.0099L13.8299 20.3847C13.679 19.8267 13.3585 19.3333 12.8871 19.1008C11.7106 18.5165 10.4142 18.0514 9 17.8169V17.3498H15.8313C16.7742 17.3498 17.4813 18.0514 17.5991 18.8663L19.2491 27.6173L23.4877 17.3498H27.6104L21.2505 32.5165ZM29.9675 32.5165H25.9626L29.2604 17.3498H33.2653L29.9675 32.5165ZM38.4467 21.5514C38.5646 20.7346 39.2717 20.2675 40.0967 20.2675C41.3931 20.1502 42.8052 20.3848 43.9838 20.9671L44.6909 17.7016C43.5123 17.2345 42.216 17 41.0395 17C37.1524 17 34.3239 19.1008 34.3239 22.0165C34.3239 24.2346 36.3274 25.3992 37.7417 26.1008C39.2717 26.8004 39.861 27.2675 39.7431 27.9671C39.7431 29.0165 38.5646 29.4836 37.3881 29.4836C35.9739 29.4836 34.5596 29.1338 33.2653 28.5494L32.5582 31.8169C33.9724 32.3992 35.5025 32.6338 36.9167 32.6338C41.2752 32.749 43.9838 30.6502 43.9838 27.5C43.9838 23.5329 38.4467 23.3004 38.4467 21.5514ZM58 32.5165L54.82 17.3498H51.4044C50.6972 17.3498 49.9901 17.8169 49.7544 18.5165L43.8659 32.5165H47.9887L48.8116 30.3004H53.8772L54.3486 32.5165H58ZM51.9936 21.4342L53.1701 27.1502H49.8723L51.9936 21.4342Z"
      fill="#172B85"
    />
  </svg>
);

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  icon: React.ReactNode;
  popular: boolean;
  badge?: string;
}

const VIDEO_SECONDS_MIN = 30;
const VIDEO_SECONDS_MAX = 500;
const VIDEO_SECONDS_STEP = 5;
const VIDEO_SECONDS_DEFAULT = 50;
const VIDEO_PRICE_PER_STEP = 0.69;

export function PricingClient() {
  const [isYearly, setIsYearly] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Track which plan/interval is currently processing a payment
  const [processingItem, setProcessingItem] = useState<string | null>(null);
  const [videoSeconds, setVideoSeconds] = useState(VIDEO_SECONDS_DEFAULT);
  const t = useTranslations("pricing");
  const tCommon = useTranslations("common");
  const { user } = useUserContext();
  const { redirectToLogin } = useAuthRedirect();
  const router = useLocaleRouter();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const videoPrice = useMemo(() => {
    const total = (videoSeconds / VIDEO_SECONDS_STEP) * VIDEO_PRICE_PER_STEP;
    return Number(total.toFixed(2));
  }, [videoSeconds]);

  const videoCreditsItemId = useMemo(
    () => `video-credits-${videoSeconds}`,
    [videoSeconds]
  );

  const pricePerStep = useMemo(
    () => currencyFormatter.format(VIDEO_PRICE_PER_STEP),
    [currencyFormatter]
  );

  const formattedVideoPrice = useMemo(
    () => currencyFormatter.format(videoPrice),
    [currencyFormatter, videoPrice]
  );

  const handleVideoSliderChange = (value: number[]) => {
    const rawValue = value[0] ?? VIDEO_SECONDS_MIN;
    const clampedValue = Math.min(
      VIDEO_SECONDS_MAX,
      Math.max(VIDEO_SECONDS_MIN, rawValue)
    );
    setVideoSeconds(clampedValue);
  };

  const handleVideoCreditsPurchase = () => {
    handleTrustpayPopup(videoCreditsItemId);
  };

  const currentPathWithQuery = useMemo(() => {
    if (typeof window === "undefined") return "/pricing";
    return window.location.pathname + window.location.search;
  }, []);

  const handleTrustpayPopup = async (item: string) => {
    // Require authentication before initiating payment
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Disable all pay buttons and show loader for the clicked one
    setProcessingItem(item);
    try {
      const { gatewayUrl } = await finbyApi.initiatePayment(item);
      if (!gatewayUrl) {
        console.error("Finby gateway URL is not available");
        return;
      }

      const trustpayIframe = document.getElementById(
        "TrustPayFrame"
      ) as HTMLIFrameElement;
      if (trustpayIframe) {
        trustpayIframe.src = gatewayUrl;
      } else {
        console.error("TrustPay iframe not found");
        return;
      }

      // Open popup (user interaction already occurred on click)
      window.openPopup();
    } catch (err) {
      console.error("Error initiating TrustPay payment:", err);
    } finally {
      // Re-enable buttons regardless of success/failure
      setProcessingItem(null);
    }
  };

  // Dynamic plans data using translations
  const plans: PricingPlan[] = [
    {
      id: "starter",
      name: t("planDetails.starter.name"),
      description: t("planDetails.starter.description"),
      monthlyPrice: 9,
      yearlyPrice: 90,
      icon: <Star className="w-6 h-6" />,
      popular: false,
      features: [t("planDetails.starter.features.0")],
    },
    {
      id: "unlimited",
      name: t("planDetails.unlimited.name"),
      description: t("planDetails.unlimited.description"),
      monthlyPrice: 20,
      yearlyPrice: 200,
      icon: <Zap className="w-6 h-6" />,
      popular: true,
      badge: t("planDetails.unlimited.badge"),
      features: [t("planDetails.unlimited.features.0")],
    },
    {
      id: "pro",
      name: t("planDetails.pro.name"),
      description: t("planDetails.pro.description"),
      monthlyPrice: 30,
      yearlyPrice: 300,
      icon: <Crown className="w-6 h-6" />,
      popular: false,
      badge: t("planDetails.pro.badge"),
      features: [
        t("planDetails.pro.features.0"),
        t("planDetails.pro.features.9"),
        t("planDetails.pro.features.1"),
        t("planDetails.pro.features.2"),
        t("planDetails.pro.features.3"),
        t("planDetails.pro.features.4"),
        t("planDetails.pro.features.5"),
        t("planDetails.pro.features.6"),
        t("planDetails.pro.features.7"),
        t("planDetails.pro.features.8"),
      ],
    },
  ];

  const getPrice = (plan: PricingPlan) => {
    return isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getDiscountPercentage = (plan: PricingPlan) => {
    const monthlyTotal = plan.monthlyPrice * 12;
    const yearlyPrice = plan.yearlyPrice;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  };

  const scrollToPricing = () => {
    const pricingSection = document.getElementById("pricing-plans");
    if (pricingSection) {
      const elementPosition =
        pricingSection.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - 150; // Adjust to show toggle + 10px above it

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 sm:py-16 lg:py-24">
        <div className="mx-auto flex max-w-5xl flex-col gap-12 lg:gap-16">
          <section className="flex flex-col gap-6 rounded-3xl border border-primary/15 bg-primary/5 p-6 shadow-lg shadow-primary/10 sm:p-8">
            <div className="inline-flex items-center gap-2 text-primary">
              <Clapperboard className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">
                {t("videoCredits.badge", { fallback: "Video Credits" } as any)}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                {t("videoCredits.title", {
                  fallback: "Add extra video credits whenever you need",
                } as any)}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("videoCredits.description", {
                  fallback:
                    "Those are seconds you buy to generate videos. Adjust the slider to pick the exact amount you need.",
                } as any)}
              </p>
            </div>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              <div className="flex-1 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("videoCredits.sliderLabel", {
                        fallback: "Select seconds",
                      } as any)}
                    </p>
                    <p className="text-3xl font-bold text-foreground sm:text-4xl">
                      {t("videoCredits.selectedSeconds", {
                        seconds: videoSeconds,
                        fallback: `${videoSeconds} seconds`,
                      } as any)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("videoCredits.priceBreakdown", {
                        price: pricePerStep,
                        step: VIDEO_SECONDS_STEP,
                        fallback: `Price is ${pricePerStep} every ${VIDEO_SECONDS_STEP} seconds`,
                      } as any)}
                    </p>
                    <p className="text-lg font-semibold text-foreground sm:text-xl">
                      {t("videoCredits.total", {
                        amount: formattedVideoPrice,
                        fallback: formattedVideoPrice,
                      } as any)}
                    </p>
                  </div>
                </div>
                <Slider
                  value={[videoSeconds]}
                  onValueChange={handleVideoSliderChange}
                  min={VIDEO_SECONDS_MIN}
                  max={VIDEO_SECONDS_MAX}
                  step={VIDEO_SECONDS_STEP}
                  aria-label={t("videoCredits.sliderAriaLabel", {
                    fallback: "Video credits slider",
                  } as any)}
                />
              </div>
              <div className="sm:w-48">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={Boolean(processingItem)}
                  onClick={handleVideoCreditsPurchase}
                >
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-3">
                    {processingItem?.startsWith("video-credits") ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="font-semibold whitespace-nowrap">
                          {t("processing")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold whitespace-nowrap">
                          {t("videoCredits.payButton", {
                            amount: formattedVideoPrice,
                            fallback: `Pay ${formattedVideoPrice}`,
                          } as any)}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <MastercardLogo className="h-6 w-auto" />
                          <VisaLogo className="h-6 w-auto" />
                        </div>
                      </>
                    )}
                  </div>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {t("videoCredits.helper", {
                    fallback:
                      "Use these credits to generate premium AI videos anytime.",
                  } as any)}
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-border/60" />

          <section className="flex flex-col items-center gap-6 text-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t("subtitle")}
            </p>
          </section>

          <section className="flex w-full flex-col items-center">
            <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors",
                      !isYearly ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {t("monthly")}
                  </span>
                  <button
                    onClick={() => setIsYearly(!isYearly)}
                    className={cn(
                      "relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isYearly ? "bg-primary" : "bg-muted"
                    )}
                    aria-label={t("toggleBilling", {
                      fallback: "Toggle billing interval",
                    } as any)}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                        isYearly ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isYearly ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {t("yearly")}
                  </span>
                </div>
                {isYearly && (
                  <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-800/40 dark:text-green-100">
                    {t("saveUpTo")}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-card/60 p-4 sm:p-6">
            <div
              id="pricing-plans"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            >
              {plans.map((plan) => {
                const planItem = isYearly
                  ? `${plan.id}-yearly`
                  : `${plan.id}-monthly`;
                const isProcessing = processingItem === planItem;
                const isCurrentPlanActive =
                  user?.planInfo?.plan === plan.id && user?.planInfo?.isActive;

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "relative flex h-full flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                      plan.popular
                        ? "border-primary/80 shadow-lg ring-2 ring-primary/20"
                        : "border-border"
                    )}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                        <div
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium text-white",
                            plan.popular ? "bg-primary" : "bg-foreground"
                          )}
                        >
                          {plan.badge}
                        </div>
                      </div>
                    )}

                    <CardHeader className="flex flex-col items-center gap-4 pb-6 pt-10 text-center">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-xl",
                          plan.popular
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {plan.icon}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-foreground">
                          {plan.name}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {plan.description}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-foreground">
                            ${getPrice(plan)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /{isYearly ? t("year") : t("month")}
                          </span>
                        </div>
                        {isYearly && (
                          <div className="text-sm font-medium text-primary">
                            {t("saveVsMonthly", {
                              percentage: getDiscountPercentage(plan),
                            })}
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-1 flex-col gap-5 pb-8">
                      {isCurrentPlanActive ? (
                        <div className="w-full rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground text-center">
                          {t("currentPlanMessage", {
                            fallback: "This is your current active plan.",
                          } as any)}
                        </div>
                      ) : (
                        <Button
                          variant={plan.popular ? "default" : "outline"}
                          size="lg"
                          className="w-full"
                          disabled={Boolean(processingItem)}
                          onClick={() => handleTrustpayPopup(planItem)}
                        >
                          <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-3">
                            {isProcessing ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="font-semibold whitespace-nowrap">
                                  {t("processing")}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-semibold whitespace-nowrap">
                                  {t("pay")}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <MastercardLogo className="h-6 w-auto" />
                                  <VisaLogo className="h-6 w-auto" />
                                </div>
                              </>
                            )}
                          </div>
                        </Button>
                      )}

                      <div className="space-y-3">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <Check className="h-5 w-5 flex-shrink-0 text-green-500" />
                            <span className="text-sm leading-relaxed text-foreground">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            {t("faq.title")}
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.changePlan.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.changePlan.answer")}
                </p>
              </div> */}

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.paymentMethods.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.paymentMethods.answer")}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.freeTrial.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.freeTrial.answer")}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.commercialUse.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.commercialUse.answer")}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.proFeatures.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.proFeatures.answer")}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.contentAfterCancel.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.contentAfterCancel.answer")}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("faq.questions.refunds.question")}
                </h3>
                <p className="text-muted-foreground">
                  {t("faq.questions.refunds.answer")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {t("cta.title")}
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t("cta.subtitle")}
            </p>
            <Button
              size="lg"
              className="text-lg px-8 py-3"
              onClick={scrollToPricing}
            >
              {t("cta.button")}
            </Button>
          </div>
        </div>
      </div>

      {/* Auth Required Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setShowAuthModal(false)}
            />
            <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-card border border-border p-6 shadow-2xl transition-all">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-yellow-100 border border-yellow-200">
                  <svg
                    className="w-6 h-6 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold leading-6 text-foreground">
                    {t("loginRequiredTitle", {
                      fallback: "Login required",
                    } as any) || "Login required"}
                  </h3>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-muted-foreground leading-relaxed">
                  {t("loginRequiredMessage", {
                    fallback:
                      "You must be logged in to purchase a plan. Please sign in or create an account.",
                  } as any) ||
                    "You must be logged in to purchase a plan. Please sign in or create an account."}
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setShowAuthModal(false);
                    redirectToLogin(currentPathWithQuery);
                  }}
                  className="w-full"
                >
                  {tCommon("signIn", { fallback: "Sign In" } as any) ||
                    "Sign In"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAuthModal(false);
                    const returnTo = encodeURIComponent(currentPathWithQuery);
                    router.push(`/auth/register?returnTo=${returnTo}`);
                  }}
                  className="w-full"
                >
                  {tCommon("register", { fallback: "Register" } as any) ||
                    "Register"}
                </Button>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {tCommon("cancel", { fallback: "Cancel" } as any) || "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
