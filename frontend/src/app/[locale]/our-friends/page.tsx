import type { Metadata } from "next";
import { locales } from "@/i18n";
import { OurFriendsClient } from "@/components/OurFriendsClient";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type OurFriendsPageProps = {
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
}: OurFriendsPageProps): Promise<Metadata> {
  const { locale } = params;

  return generateTranslatedOpenGraphMetadata({
    locale,
    titleKey: "metaTitle",
    descriptionKey: "metaDescription",
    namespace: "ourFriends",
    url: generateSiteUrl(locale, "our-friends"),
    type: "website",
    additionalKeywords: [
      "partners",
      "friends",
      "AI platforms",
      "adult content partners",
      "affiliate links",
      "recommended sites",
    ],
  });
}

export default function OurFriendsPage() {
  return <OurFriendsClient />;
}
