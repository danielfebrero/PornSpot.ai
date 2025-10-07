import type { Metadata } from "next";

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

export default function FaqPage() {
  return <FaqClient />;
}
