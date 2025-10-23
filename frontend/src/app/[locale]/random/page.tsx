import { Metadata } from "next";
import { locales } from "@/i18n";
import { RandomClient } from "@/components/RandomClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type RandomPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const revalidate = false;
export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: RandomPageProps): Promise<Metadata> {
  const { locale } = await params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    namespace: "generate",
    url: generateSiteUrl(locale, "random"),
    type: "website",
    additionalKeywords: [
      "AI generation",
      "adult creation",
      "surprise me",
      "random prompt",
      "instant generation",
    ],
  });
}

export default function RandomPage() {
  return <RandomClient />;
}
