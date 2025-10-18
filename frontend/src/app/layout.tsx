import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { headers } from "next/headers";
import { defaultLocale } from "@/i18n";
import { AppErrorBoundary } from "@/components/ErrorBoundaries";
import "./globals.css";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get locale from middleware header
  const headersList = await headers();
  const locale = headersList.get("x-locale") || defaultLocale;

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/180.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/16.png" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Script
          src="https://code.jquery.com/jquery-3.7.1.slim.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://mapi.finby.eu/mapi5/Scripts/finby/popup.js"
          strategy="beforeInteractive"
        />
        <GoogleAnalytics gaId="G-PYFTNPNT0E" />
        <AppErrorBoundary context="Root Application">
          <iframe id="TrustPayFrame" title="Finby payment frame"></iframe>
          {children}
        </AppErrorBoundary>
      </body>
    </html>
  );
}
