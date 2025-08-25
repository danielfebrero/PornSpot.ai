"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Check, Star, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

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

export function PricingClient() {
  const [isYearly, setIsYearly] = useState(false);
  const t = useTranslations("pricing");

  // Dynamic plans data using translations
  const plans: PricingPlan[] = [
    {
      id: "starter",
      name: t("planDetails.starter.name"),
      description: t("planDetails.starter.description"),
      monthlyPrice: 10,
      yearlyPrice: 100,
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
        t("planDetails.pro.features.1"),
        t("planDetails.pro.features.2"),
        t("planDetails.pro.features.3"),
        t("planDetails.pro.features.4"),
        t("planDetails.pro.features.5"),
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
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            {t("title")}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
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
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isYearly ? "bg-primary" : "bg-muted"
              )}
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
            {isYearly && (
              <div className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 px-2 py-1 rounded-full text-xs font-medium ml-2">
                {t("saveUpTo")}
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <div
            id="pricing-plans"
            className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "relative transition-all duration-300 hover:shadow-lg hover:scale-105",
                  plan.popular
                    ? "border-primary shadow-lg ring-2 ring-primary/20"
                    : "border-border"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
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

                <CardHeader className="text-center pb-8 pt-8">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4",
                      plan.popular
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {plan.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {plan.description}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-foreground">
                        ${getPrice(plan)}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        /{isYearly ? t("year") : t("month")}
                      </span>
                    </div>
                    {isYearly && (
                      <div className="text-sm text-muted-foreground">
                        {t("saveVsMonthly", {
                          percentage: getDiscountPercentage(plan),
                        })}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    className="w-full"
                  >
                    {t("getStarted")}
                  </Button>

                  <div className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-foreground">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
    </div>
  );
}
