"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { LocaleLink } from "@/components/ui/LocaleLink";

export function PrivacyClient() {
  const t = useTranslations("privacy");

  // Get current date for last updated
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sections = [
    "introduction",
    "informationWe",
    "howWe",
    "informationSharing",
    "dataStorage",
    "cookies",
    "dataRetention",
    "yourRights",
    "childrenPrivacy",
    "internationalTransfers",
    "gdprCompliance",
    "ukGdpr",
    "californiaCcpa",
    "aiEthics",
    "thirdPartyLinks",
    "policyChanges",
    "contact",
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          {t("lastUpdated", { date: currentDate })}
        </p>
      </div>

      {/* Table of Contents */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("ui.tableOfContents")}</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sections.map((section, index) => (
              <a
                key={section}
                href={`#${section}`}
                className="text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded hover:bg-accent"
              >
                {index + 1}. {t(`${section}.title`)}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Privacy Sections */}
      <div className="space-y-8">
        {sections.map((section, index) => (
          <Card key={section} id={section} className="scroll-mt-20">
            <CardHeader>
              <h2 className="text-2xl font-semibold flex items-center gap-3">
                <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </span>
                {t(`${section}.title`)}
              </h2>
            </CardHeader>
            <CardContent>
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  {t(`${section}.content`)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                {t("ui.questionsTitle")}
              </h3>
              <p className="text-muted-foreground">
                {t("ui.questionsDescription")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="mailto:support@pornspot.ai"
                  className="inline-flex items-center justify-center px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {t("ui.contactSupport")}
                </a>
                <LocaleLink
                  href="/terms"
                  className="inline-flex items-center justify-center px-6 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  {t("ui.termsOfService")}
                </LocaleLink>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
