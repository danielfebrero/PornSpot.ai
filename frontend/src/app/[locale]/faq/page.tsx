import type { Metadata } from "next";

import Script from "next/script";
import { getTranslations } from "next-intl/server";

import { FaqClient } from "@/components/FaqClient";
import { locales } from "@/i18n";
import {
  generateSiteUrl,
  generateTranslatedOpenGraphMetadata,
} from "@/lib/opengraph";

type FaqPageProps = {
  params: { locale: string };
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const revalidate = false;

export async function generateMetadata({
  params,
}: FaqPageProps): Promise<Metadata> {
  const { locale } = params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    namespace: "faqPage",
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    url: generateSiteUrl(locale, "faq"),
    type: "website",
    additionalKeywords: [
      "AI porn FAQ",
      "LoRA models",
      "NSFW AI video",
      "subscription help",
      "adult content questions",
    ],
  });
}

const sanitizeAnswer = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const faqQuestionKeys: Array<{
  section: "general" | "usage" | "safety" | "content";
  item: string;
}> = [
  { section: "general", item: "whatIs" },
  { section: "general", item: "howWorks" },
  { section: "general", item: "isFree" },
  { section: "general", item: "ageRestrictions" },
  { section: "usage", item: "customizeContent" },
  { section: "usage", item: "videoSupport" },
  { section: "usage", item: "unhappyOutput" },
  { section: "usage", item: "platformUpdates" },
  { section: "safety", item: "ethicalContent" },
  { section: "safety", item: "dataPrivacy" },
  { section: "safety", item: "prohibitedContent" },
  { section: "content", item: "downloadsSharing" },
];

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "faqPage" });
  const pageUrl = generateSiteUrl(locale, "faq");

  const mainEntity = faqQuestionKeys
    .map(({ section, item }) => {
      const question = t(`sections.${section}.items.${item}.question`);
      const answer = sanitizeAnswer(
        t(`sections.${section}.items.${item}.answer`)
      );

      if (!answer) {
        return null;
      }

      return {
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      } as const;
    })
    .filter(
      (
        entity
      ): entity is {
        "@type": "Question";
        name: string;
        acceptedAnswer: { "@type": "Answer"; text: string };
      } => entity !== null
    );

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    inLanguage: locale,
    mainEntity,
  };

  return (
    <>
      {mainEntity.length > 0 && (
        <Script
          id="faq-structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify(faqStructuredData)}
        </Script>
      )}
      <FaqClient />
    </>
  );
}
