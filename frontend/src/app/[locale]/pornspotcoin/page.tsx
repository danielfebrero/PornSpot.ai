import type { Metadata } from "next";
import { locales } from "@/i18n";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";
import { PublicPSCPageClient } from "@/components/pornspotcoin/PublicPSCPageClient";

type PornSpotCoinPageProps = {
  params: { locale: string };
};

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Enable pure SSG
export const revalidate = false;

export async function generateMetadata({
  params,
}: PornSpotCoinPageProps): Promise<Metadata> {
  const { locale } = params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "meta.title",
    descriptionKey: "meta.description",
    namespace: "pornspotcoin",
    url: generateSiteUrl(locale, "pornspotcoin"),
    type: "website",
    additionalKeywords: [
      "PornSpotCoin",
      "PSC",
      "rewards",
      "token",
      "membership",
    ],
  });
}

export default function PornSpotCoinPublicPage() {
  return <PublicPSCPageClient />;
}
