import type { Metadata } from "next";
import { locales } from "@/i18n";
import { PricingClient } from "@/components/PricingClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type PricingPageProps = {
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
}: PricingPageProps): Promise<Metadata> {
  const { locale } = await params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    namespace: "pricing",
    url: generateSiteUrl(locale, "pricing"),
    type: "website",
    additionalKeywords: [
      "AI pricing",
      "generated plans",
      "adult subscription",
      "generation pricing",
      "membership",
      "adult plans",
    ],
  });
}

export default function PricingPage() {
  return <PricingClient />;
}
