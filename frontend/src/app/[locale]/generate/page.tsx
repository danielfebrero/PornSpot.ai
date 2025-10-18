import { Metadata } from "next";
import { locales } from "@/i18n";
import { GenerateClient } from "@/components/GenerateClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type GeneratePageProps = {
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
}: GeneratePageProps): Promise<Metadata> {
  const { locale } = await params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    namespace: "generate",
    url: generateSiteUrl(locale, "generate"),
    type: "website",
    additionalKeywords: [
      "AI generation",
      "adult creation",
      "custom parameters",
      "lora models",
      "bulk generation",
    ],
  });
}

export default function GeneratePage() {
  return <GenerateClient />;
}
