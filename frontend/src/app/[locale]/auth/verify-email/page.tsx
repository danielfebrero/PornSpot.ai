import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locales } from "@/i18n";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/user/VerifyEmailClient";

type VerifyEmailPageProps = {
  params: Promise<{ locale: string }>;
};

// Enable ISR for this page - static generation with revalidation
export const revalidate = 86400; // revalidate every day
export const dynamic = "force-static"; // Force static generation at build time
export const dynamicParams = true; // Allow dynamic params

// Generate static pages for all locales at build time
export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: VerifyEmailPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.verifyEmail",
  });

  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

async function VerifyEmailFallback({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail" });

  return (
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-muted-foreground">{t("loadingVerification")}</p>
    </div>
  );
}

export default async function VerifyEmailPage({
  params,
}: VerifyEmailPageProps) {
  const { locale } = await params;
  return (
    <Suspense fallback={<VerifyEmailFallback locale={locale} />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
