import type { Metadata } from "next";
import { locales } from "@/i18n";
import { TermsClient } from "@/components/TermsClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type TermsPageProps = {
  params: { locale: string };
};

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable static generation with periodic revalidation
export const revalidate = false; // No revalidation needed, static generation only

export async function generateMetadata({
  params,
}: TermsPageProps): Promise<Metadata> {
  const { locale } = params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    namespace: "terms",
    url: generateSiteUrl(locale, "terms"),
    type: "website",
    additionalKeywords: [
      "terms of service",
      "legal terms",
      "AI terms",
      "adult content terms",
      "platform terms",
      "user agreement",
    ],
  });
}

export default function TermsPage() {
  return <TermsClient />;
}
