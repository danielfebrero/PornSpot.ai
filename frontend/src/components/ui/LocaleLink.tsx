"use client";

import React from "react";
import NextLink, { LinkProps } from "next/link";
import { useParams } from "next/navigation";
import { createLocalePath, hasLocalePrefix } from "@/lib/navigation";

interface LocaleLinkProps extends Omit<LinkProps, "href"> {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * A locale-aware Link component that automatically prefixes URLs with the current locale
 */
export function LocaleLink({
  href,
  children,
  className,
  onClick,
  ...props
}: LocaleLinkProps) {
  const params = useParams();
  const locale = params.locale as string;

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

  return (
    <NextLink
      href={finalHref}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </NextLink>
  );
}

// Export as default for easier importing
export default LocaleLink;
