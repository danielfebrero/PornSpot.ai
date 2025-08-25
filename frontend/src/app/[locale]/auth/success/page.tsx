import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locales } from "@/i18n";
import { Suspense } from "react";
import { AuthSuccessClient } from "@/components/user/AuthSuccessClient";

type AuthSuccessPageProps = {
  params: { locale: string };
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
}: AuthSuccessPageProps): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "auth.success",
  });

  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

async function AuthSuccessFallback({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "auth.success" });

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-6">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t("loading")}
        </h2>
        <p className="text-muted-foreground">{t("processingAuth")}</p>
      </div>
    </div>
  );
}

export default function AuthSuccessPage({ params }: AuthSuccessPageProps) {
  return (
    <Suspense fallback={<AuthSuccessFallback locale={params.locale} />}>
      <AuthSuccessClient />
    </Suspense>
  );
}
