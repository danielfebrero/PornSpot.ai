import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locales } from "@/i18n";
import { Suspense } from "react";
import RegisterForm from "@/components/user/RegisterForm";

type RegisterPageProps = {
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
}: RegisterPageProps): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "auth.register",
  });

  return {
    title: t("meta.title"),
    description: t("meta.description"),
  };
}

async function RegisterFallback({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-muted-foreground">{t("loading")}</p>
    </div>
  );
}

export default function RegisterPage({ params }: RegisterPageProps) {
  return (
    <Suspense fallback={<RegisterFallback locale={params.locale} />}>
      <RegisterForm />
    </Suspense>
  );
}
