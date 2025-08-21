import { Metadata } from "next";
import { locales } from "@/i18n";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/user/ResetPasswordForm";
import {
  generateTranslatedOpenGraphMetadata,
  generateSiteUrl,
} from "@/lib/opengraph";

type ResetPasswordPageProps = {
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
}: ResetPasswordPageProps): Promise<Metadata> {
  return generateTranslatedOpenGraphMetadata({
    locale: params.locale,
    titleKey: "meta.title",
    descriptionKey: "meta.description",
    namespace: "auth.resetPassword",
    url: generateSiteUrl(params.locale, "auth/reset-password"),
    type: "website",
  });
}

function ResetPasswordFallback() {
  return (
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-muted-foreground">Loading reset password form...</p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
