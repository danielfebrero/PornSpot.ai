"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import LocaleLink from "@/components/ui/LocaleLink";
import { cn } from "@/lib/utils";

const imageLoras = [
  { key: "leakedNudes", name: "leaked_nudes_style_v1_fixed" },
  { key: "piercedNipples", name: "Pierced_Nipples_XL_Barbell_Edition-000013" },
  { key: "addDetail", name: "add-detail-xl" },
  { key: "harnessStraps", name: "Harness_Straps_sdxl" },
  { key: "bdsm", name: "bdsm_SDXL_1_" },
  { key: "bodyTattoo", name: "Body Tattoo_alpha1.0_rank4_noxattn_last" },
  { key: "doggystyleAnal", name: "Doggystyle anal XL" },
  { key: "realDownblouse", name: "RealDownblouseXLv3" },
  { key: "sextoyDildo", name: "Sextoy_Dildo_Pussy_v2_XL" },
  { key: "bread", name: "bread" },
  { key: "nudify", name: "nudify_xl_lite" },
  { key: "dynaPose", name: "DynaPoseV1" },
] as const;

const videoLoras = [
  { key: "dr34ml4y", name: "DR34ML4Y" },
  { key: "bouncingBoobs", name: "BOUNCING_BOOBS" },
  { key: "oralInsertion", name: "ORAL_INSERTION" },
  { key: "f4c3spl4sh", name: "F4C3SPL4SH" },
  { key: "penisPlay", name: "PENIS_PLAY" },
  { key: "posingNude", name: "POSING_NUDE" },
  { key: "deepthroat", name: "DEEPTHROAT" },
  { key: "boobjob", name: "BOOBJOB" },
  { key: "fingering", name: "FINGERING" },
  { key: "middleDrooling", name: "MIDDLE_DROOLING" },
  { key: "orgasm", name: "ORGASM" },
  { key: "facedownAssup", name: "FACEDOWNASSUP" },
] as const;

interface FaqSection {
  key:
    | "general"
    | "usage"
    | "safety"
    | "content"
    | "billing"
    | "lorasImage"
    | "lorasVideo";
  icon: string;
  layout?: "single" | "grid";
  items: readonly string[];
}

export function FaqClient() {
  const t = useTranslations("faqPage");

  const sections = useMemo<readonly FaqSection[]>(
    () => [
      {
        key: "general",
        icon: "💡",
        items: ["whatIs", "howWorks", "isFree", "ageRestrictions"],
      },
      {
        key: "usage",
        icon: "🎨",
        items: [
          "customizeContent",
          "videoSupport",
          "unhappyOutput",
          "platformUpdates",
        ],
      },
      {
        key: "safety",
        icon: "🛡️",
        items: ["ethicalContent", "dataPrivacy", "prohibitedContent"],
      },
      {
        key: "content",
        icon: "📥",
        items: ["downloadsSharing"],
      },
      {
        key: "billing",
        icon: "💳",
        items: ["paymentMethods"],
      },
      {
        key: "lorasImage",
        icon: "🖼️",
        items: ["imageLoras"],
        layout: "single",
      },
      {
        key: "lorasVideo",
        icon: "🎬",
        items: ["videoLoras"],
        layout: "single",
      },
    ],
    []
  );

  const renderAnswer = (sectionKey: FaqSection["key"], itemKey: string) => {
    if (sectionKey === "lorasImage" && itemKey === "imageLoras") {
      return (
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>{t("loras.image.intro")}</p>
          <ul className="list-disc pl-6 space-y-2">
            {imageLoras.map((lora) => (
              <li key={lora.key}>
                <span className="font-semibold text-foreground break-all">
                  {lora.name}
                </span>
                <span className="ml-2">
                  {t(`loras.image.items.${lora.key}`)}
                </span>
              </li>
            ))}
          </ul>
          <p>{t("loras.image.outro")}</p>
        </div>
      );
    }

    if (sectionKey === "lorasVideo" && itemKey === "videoLoras") {
      return (
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>{t("loras.video.intro")}</p>
          <ul className="list-disc pl-6 space-y-2">
            {videoLoras.map((lora) => (
              <li key={lora.key}>
                <span className="font-semibold text-foreground break-all">
                  {lora.name}
                </span>
                <span className="ml-2">
                  {t(`loras.video.items.${lora.key}`)}
                </span>
              </li>
            ))}
          </ul>
          <p>{t("loras.video.outro")}</p>
        </div>
      );
    }

    if (sectionKey === "billing" && itemKey === "paymentMethods") {
      return (
        <div className="space-y-3 text-muted-foreground leading-relaxed">
          {t.rich("sections.billing.items.paymentMethods.answer", {
            strong: (chunks) => (
              <strong className="text-foreground font-semibold">
                {chunks}
              </strong>
            ),
            p: (chunks) => <p>{chunks}</p>,
            list: (chunks) => (
              <ul className="list-disc pl-6 space-y-2">{chunks}</ul>
            ),
            item: (chunks) => <li>{chunks}</li>,
            link: (chunks) => (
              <LocaleLink
                href="/pricing"
                className="text-primary underline-offset-4 hover:underline"
              >
                {chunks}
              </LocaleLink>
            ),
          })}
        </div>
      );
    }

    return (
      <p className="text-muted-foreground leading-relaxed">
        {t(`sections.${sectionKey}.items.${itemKey}.answer`)}
      </p>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-16 lg:py-20">
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          {t("hero.tagline")}
        </div>
        <h1 className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
          {t("hero.subtitle")}
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LocaleLink
            href="/generate"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
          >
            {t("hero.ctaGenerate")}
          </LocaleLink>
          <LocaleLink
            href="/pricing"
            className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            {t("hero.ctaPricing")}
          </LocaleLink>
        </div>
      </section>

      <div className="mt-16 space-y-16">
        {sections.map((section) => (
          <section key={section.key} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-2xl">
                <span role="img" aria-label="section icon">
                  {section.icon}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {t(`sections.${section.key}.title`)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(`sections.${section.key}.description`)}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-6",
                section.layout === "single"
                  ? "grid-cols-1"
                  : "grid-cols-1 md:grid-cols-2"
              )}
            >
              {section.items.map((itemKey) => (
                <Card
                  key={itemKey}
                  className="border-border/70 bg-card/60 backdrop-blur transition hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      {t(`sections.${section.key}.items.${itemKey}.question`)}
                    </h3>
                    {renderAnswer(section.key, itemKey)}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-20 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 p-10 text-center shadow-lg shadow-primary/10">
        <h2 className="text-3xl font-bold text-foreground">{t("cta.title")}</h2>
        <p className="mt-4 text-muted-foreground">{t("cta.subtitle")}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LocaleLink
            href="/generate"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:bg-primary/90"
          >
            {t("cta.primary")}
          </LocaleLink>
          <LocaleLink
            href="/discover"
            className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            {t("cta.secondary")}
          </LocaleLink>
        </div>
      </section>
    </div>
  );
}

export default FaqClient;
