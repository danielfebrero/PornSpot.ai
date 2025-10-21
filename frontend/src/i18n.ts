import { getRequestConfig } from "next-intl/server";

// Static list of available locales - update this when adding new translation files
// This avoids using Node.js modules that aren't available in Edge Runtime
export const locales = ["de", "en", "es", "fr", , "hi", "ru", "zh"] as const;
export const defaultLocale = "en" as const;

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  try {
    const messages = (await import(`./locales/${locale}.json`)).default;

    return {
      locale,
      messages,
    };
  } catch (error) {
    // Fallback to default locale if there's an error loading the messages
    const fallbackMessages = (await import(`./locales/${defaultLocale}.json`))
      .default;
    return {
      locale: defaultLocale,
      messages: fallbackMessages,
    };
  }
});
