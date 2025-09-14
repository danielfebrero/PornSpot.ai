"use client";

import { Coins, TrendingUp, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import LocaleLink from "@/components/ui/LocaleLink";
import { usePSCRates } from "@/hooks/queries/usePSCQuery";

export function PublicPSCPageClient() {
  const t = useTranslations("pornspotcoin");
  const { data: ratesData, isLoading } = usePSCRates();

  const rates = ratesData?.rates || {
    viewRate: 0,
    likeRate: 0,
    commentRate: 0,
    bookmarkRate: 0,
    profileViewRate: 0,
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container mx-auto px-4 py-10 md:py-16">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-12">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full text-xs font-medium">
              <Coins className="h-4 w-4" /> PSC
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              {t("public.title")}
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              {t("dashboard.description")}
            </p>
            <ul className="list-disc pl-5 text-sm md:text-base space-y-1 text-foreground/90">
              <li>{t("public.tokenDescription")}</li>
              <li>{t("public.membershipDescription")}</li>
              <li>{t("public.starterMembership")}</li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <LocaleLink href="/pricing">
                <Button size="lg" className="w-full sm:w-auto">
                  {t("public.exploreMemberships")}
                </Button>
              </LocaleLink>
            </div>
          </div>

          {/* Rates card */}
          <Card className="w-full md:max-w-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t("rates.title")}
                </h3>
                <Badge
                  variant="outline"
                  className="text-yellow-700 border-yellow-700"
                >
                  <Activity className="h-3 w-3 mr-1" />{" "}
                  {t("dashboard.liveData")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <RateItem
                  label={t("rates.views")}
                  value={rates.viewRate}
                  loading={isLoading}
                />
                <RateItem
                  label={t("rates.likes")}
                  value={rates.likeRate}
                  loading={isLoading}
                />
                <RateItem
                  label={t("rates.comments")}
                  value={rates.commentRate}
                  loading={isLoading}
                />
                <RateItem
                  label={t("rates.bookmarks")}
                  value={rates.bookmarkRate}
                  loading={isLoading}
                />
                <RateItem
                  label={t("rates.profileViews")}
                  value={rates.profileViewRate}
                  loading={isLoading}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <FeatureCard
            title={t("public.howItWorks.create.title")}
            description={t("public.howItWorks.create.description")}
          />
          <FeatureCard
            title={t("public.howItWorks.earn.title")}
            description={t("public.howItWorks.earn.description")}
          />
          <FeatureCard
            title={t("public.howItWorks.use.title")}
            description={t("public.howItWorks.use.description")}
          />
        </div>
      </section>

      {/* Exchange */}
      <section className="container mx-auto px-4 pb-12 md:pb-16">
        <Card>
          <CardContent className="py-6 md:py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  {t("public.exchange.membershipExchange")}
                </div>
                <div className="text-xl md:text-2xl font-semibold">
                  {t("public.exchange.starterRate")}
                </div>
              </div>
              <LocaleLink href="/pricing">
                <Button size="lg">
                  {t("public.exchange.seePlans")}
                  <TrendingUp className="ml-2 h-4 w-4" />
                </Button>
              </LocaleLink>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RateItem({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">
        {loading ? "—" : value.toFixed(4)}{" "}
        <span className="text-xs text-muted-foreground">PSC</span>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-lg font-semibold mb-1">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
