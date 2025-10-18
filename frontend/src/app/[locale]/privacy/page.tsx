import type { Metadata } from "next";
import { locales } from "@/i18n";
import { PrivacyClient } from "@/components/PrivacyClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable static generation with periodic revalidation
export const revalidate = false; // No revalidation needed, static generation only
export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    namespace: "privacy",
    url: generateSiteUrl(locale, "privacy"),
    type: "website",
    additionalKeywords: [
      "privacy policy",
      "data protection",
      "AI privacy",
      "adult content privacy",
      "GDPR compliance",
      "data security",
    ],
  });
}

export default function PrivacyPage() {
  return <PrivacyClient />;
}
