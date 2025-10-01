import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { QueryProvider } from "@/providers/QueryProvider";
import { PrefetchProvider } from "@/contexts/PrefetchContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { UserProvider } from "@/contexts/UserContext";
import { NavigationLoadingProvider } from "@/contexts/NavigationLoadingContext";
import { DeviceProvider } from "@/contexts/DeviceContext";
import { ReturnUrlProvider } from "@/contexts/ReturnUrlContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { GenerationProvider } from "@/contexts/GenerationContext";
import { ScrollRestorationProvider } from "@/contexts/ScrollRestorationContext";

import { Header } from "@/components/Header";
import { AgeGateWrapper } from "@/components/age-gate/AgeGateWrapper";
import { PermissionsWrapper } from "@/components/PermissionsWrapper";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { NavigationLoadingOverlay } from "@/components/ui/NavigationLoadingOverlay";
import { MobileNavigationWrapper } from "@/components/MobileNavigationWrapper";
import { LanguageRedirect } from "@/components/LanguageRedirect";
import { LocaleLink } from "@/components/ui/LocaleLink";
import { detectDevice } from "@/lib/deviceUtils";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import {
  PageErrorBoundary,
  SectionErrorBoundary,
} from "@/components/ErrorBoundaries";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "site" });

  return {
    title: t("title"),
    description: t("description"),
    keywords: [
      "AI porn",
      "generated porn",
      "AI adult content",
      "porn images",
      "porn videos",
      "AI generator",
      "adult AI",
      "custom porn",
      "LoRA porn",
    ],
    authors: [{ name: "PornSpot.ai" }],
    creator: "PornSpot.ai",
    publisher: "PornSpot.ai",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(
      process.env["NEXT_PUBLIC_SITE_URL"] || "https://pornspot.ai"
    ),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "https://pornspot.ai",
      siteName: "PornSpot.ai",
      images: [
        {
          url: "/website.png",
          width: 1024,
          height: 1024,
          alt: "PornSpot.ai - AI Generated Porn",
        },
      ],
      locale: locale === "en" ? "en_US" : locale === "fr" ? "fr_FR" : "de_DE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/website.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    ...(process.env["GOOGLE_SITE_VERIFICATION"] && {
      verification: {
        google: process.env["GOOGLE_SITE_VERIFICATION"],
      },
    }),
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: Props) {
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: "site" });

  // Server-side device detection
  const headersList = headers();
  const userAgent = headersList.get("user-agent");
  const deviceInfo = detectDevice(userAgent);

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <QueryProvider>
        <PrefetchProvider>
          <ScrollRestorationProvider>
            <PageErrorBoundary context={`Locale Layout (${locale})`}>
              <DeviceProvider initialDeviceInfo={deviceInfo}>
                <ReturnUrlProvider>
                  <UserProvider>
                    <PermissionsWrapper>
                      <AdminProvider>
                        <WebSocketProvider>
                          <GenerationProvider>
                            <NavigationLoadingProvider>
                              <LanguageRedirect />
                              <AgeGateWrapper>
                                <div className="min-h-screen bg-background flex flex-col">
                                  <SectionErrorBoundary context="Header">
                                    <Header />
                                  </SectionErrorBoundary>
                                  <SectionErrorBoundary context="Main Content">
                                    <MainContentWrapper>
                                      {children}
                                    </MainContentWrapper>
                                  </SectionErrorBoundary>
                                  <SectionErrorBoundary context="Footer">
                                    <footer className="border-t border-border mt-16 pb-[55px] lg:pb-0 text-sm">
                                      <div className="container mx-auto py-4">
                                        <div className="text-center">
                                          <p className="text-muted-foreground whitespace-nowrap overflow-x-auto overflow-y-hidden">
                                            &copy; 2025 PornSpot.ai. 943 919 423
                                            R.C.S. Annecy, France - All rights
                                            reserved.{" "}
                                            <LocaleLink
                                              href="/terms"
                                              className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                              {t("terms")}
                                            </LocaleLink>
                                            .{" "}
                                            <LocaleLink
                                              href="/our-friends"
                                              className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                              {t("ourFriends")}
                                            </LocaleLink>
                                            .
                                          </p>
                                        </div>
                                      </div>
                                    </footer>
                                  </SectionErrorBoundary>
                                </div>
                              </AgeGateWrapper>
                              <NavigationLoadingOverlay />
                              <MobileNavigationWrapper />
                              <CookieConsentBanner />
                            </NavigationLoadingProvider>
                          </GenerationProvider>
                        </WebSocketProvider>
                      </AdminProvider>
                    </PermissionsWrapper>
                  </UserProvider>
                </ReturnUrlProvider>
              </DeviceProvider>
            </PageErrorBoundary>
          </ScrollRestorationProvider>
        </PrefetchProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
