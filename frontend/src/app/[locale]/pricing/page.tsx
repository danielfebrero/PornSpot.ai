import type { Metadata } from "next";
import { locales } from "@/i18n";
import { PricingClient } from "@/components/PricingClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type PricingPageProps = {
  params: { locale: string };
};

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable static generation with periodic revalidation
export const revalidate = 86400; // Revalidate every 24 hours (pricing changes rarely)
export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: PricingPageProps): Promise<Metadata> {
  const { locale } = params;

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
