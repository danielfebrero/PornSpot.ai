import { locales, defaultLocale } from "@/i18n";
import { useParams, useRouter } from "next/navigation";

const escapedLocales = locales.map((locale) =>
  locale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
);

const localePrefixPattern = new RegExp(
  `^/(?:${escapedLocales.join("|")})(?:/|$|\\?|#)`
);

export function hasLocalePrefix(href: string): boolean {
  return localePrefixPattern.test(href);
}

/**
 * Creates a locale-aware path
 */
export function createLocalePath(path: string, locale: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  // For default locale, we still use explicit prefix as configured
  return `/${locale}/${cleanPath}`;
}

/**
 * Gets the locale from a pathname
 */
export function getLocaleFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (locales.includes(firstSegment as any)) {
    return firstSegment;
  }

  return defaultLocale;
}

/**
 * Removes locale from pathname
 */
export function removeLocaleFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (locales.includes(firstSegment as any)) {
    return "/" + segments.slice(1).join("/");
  }

  return pathname;
}

/**
 * Checks if a pathname is the current active path
 */
export function isActivePath(pathname: string, href: string): boolean {
  // Remove locale from both paths for comparison
  const cleanPathname = removeLocaleFromPathname(pathname);
  const cleanHref = removeLocaleFromPathname(href);

  return cleanPathname === cleanHref;
}

/**
 * Navigation item type for consistent navigation across the app
 */
export interface NavigationItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  isExternal?: boolean;
}

/**
 * Creates locale-aware navigation items
 */
export function createLocaleNavigation(
  items: Omit<NavigationItem, "href">[],
  paths: string[],
  locale: string
): NavigationItem[] {
  return items.map((item, index) => ({
    ...item,
    href: createLocalePath(paths[index], locale),
  }));
}

/**
 * Hook that provides a locale-aware router.push function
 * Works the same way as LocaleLink by automatically prefixing routes with locale
 */
export function useLocaleRouter() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  /**
   * Locale-aware push function that automatically prefixes paths with current locale
   * @param href - The path to navigate to
   * @param options - Optional router push options
   */
  const push = (href: string, options?: Parameters<typeof router.push>[1]) => {
    // Check if this is an external link or already has locale
    const isExternal =
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:");
    const hasLocale = hasLocalePrefix(href);

    // If external or already has locale, use href as-is
    // If it's an API route, use as-is (API routes should remain unlocalized)
    const finalHref =
      isExternal || hasLocale ? href : createLocalePath(href, locale);

    return router.push(finalHref, options);
  };

  /**
   * Locale-aware replace function that automatically prefixes paths with current locale
   * @param href - The path to navigate to
   * @param options - Optional router replace options
   */
  const replace = (
    href: string,
    options?: Parameters<typeof router.replace>[1]
  ) => {
    // Check if this is an external link or already has locale
    const isExternal =
      href.startsWith("http") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:");
    const hasLocale = hasLocalePrefix(href);

    // If external or already has locale, use href as-is
    // If it's an API route, use as-is (API routes should remain unlocalized)
    const finalHref =
      isExternal || hasLocale || href.startsWith("/api/")
        ? href
        : createLocalePath(href, locale);

    return router.replace(finalHref, options);
  };

  return {
    ...router,
    push,
    replace,
  };
}
