"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { useUserContext } from "@/contexts/UserContext";

/**
 * Component that handles automatic language redirection based on user preferences
 * Should be included in the root layout to work on all pages
 */
export function LanguageRedirect() {
  const { user, loading } = useUserContext();
  const params = useParams();
  const router = useLocaleRouter();
  const currentLocale = params.locale as string;

  useEffect(() => {
    // Don't redirect if still loading user data
    if (loading) return;

    // Don't redirect if no user is logged in
    if (!user) return;

    // Check if user has a language preference set
    if (user.preferredLanguage && user.preferredLanguage !== currentLocale) {
      // Get current path without locale
      const currentPath = window.location.pathname;
      const pathSegments = currentPath.split("/").filter(Boolean);

      // Remove the first segment (current locale) and reconstruct path
      const pathWithoutLocale = pathSegments.slice(1).join("/");
      const newPath = pathWithoutLocale ? `/${pathWithoutLocale}` : "";

      // Add search params and hash if they exist
      const search = window.location.search;
      const hash = window.location.hash;

      // Replace the current URL with the preferred language
      router.replace(`/${user.preferredLanguage}${newPath}${search}${hash}`);
    }
  }, [user, loading, currentLocale, router]);

  // This component doesn't render anything
  return null;
}
