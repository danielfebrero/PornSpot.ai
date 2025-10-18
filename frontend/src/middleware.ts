import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { locales, defaultLocale } from "./i18n";

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // Always show locale prefix in the URL for clarity
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  // Get the locale from the pathname
  const pathname = request.nextUrl.pathname;
  const pathLocale = pathname.split("/")[1];
  const cookieLocale =
    request.cookies.get("NEXT_LOCALE")?.value ||
    request.cookies.get("ps-preferred-locale")?.value;
  const locale = locales.includes(pathLocale as any)
    ? pathLocale
    : cookieLocale && locales.includes(cookieLocale as any)
    ? cookieLocale
    : defaultLocale;

  // Run the intl middleware
  const response = intlMiddleware(request);

  // Add the locale as a header
  response.headers.set("x-locale", locale);

  return response;
}

export const config = {
  // Matcher ignoring `/_next/`, `/api/`, and static assets
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.ico|.*\\.txt|.*\\.xml|manifest.json).*)",
  ],
};
