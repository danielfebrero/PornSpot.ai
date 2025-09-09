"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

/**
 * Custom hook to manage document title and meta description with proper cleanup
 *
 * This hook provides a React-friendly way to set the document title and meta description
 * and automatically restores the previous values when the component unmounts.
 * Automatically appends the site name to the title.
 *
 * @param title - The title to set for the document (site name will be appended automatically)
 * @param description - The description to set for the meta description tag (optional)
 * @param options - Configuration options
 * @param options.restoreOnUnmount - Whether to restore the previous title and description on unmount (default: true)
 * @param options.appendSiteName - Whether to append site name to title (default: true)
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const t = useTranslations("user.likes");
 *   useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));
 *
 *   return <div>My page content</div>;
 * }
 * ```
 */
export function useDocumentHeadAndMeta(
  title: string,
  description?: string,
  options: {
    restoreOnUnmount?: boolean;
    appendSiteName?: boolean;
  } = {}
) {
  const { restoreOnUnmount = true, appendSiteName = false } = options;
  const originalTitleRef = useRef<string | null>(null);
  const originalDescriptionRef = useRef<string | null>(null);

  // Get site name from translations for interpolation
  const tSite = useTranslations("site");
  const siteName = tSite("name");

  useEffect(() => {
    // Store the original title on first mount
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }

    // Replace {siteName} placeholder in title or append site name if requested
    let fullTitle = title;
    if (title.includes("{siteName}")) {
      fullTitle = title.replace("{siteName}", siteName);
    } else if (appendSiteName && siteName) {
      fullTitle = `${title} - ${siteName}`;
    }

    document.title = fullTitle;

    // Cleanup function to restore original title
    return () => {
      if (restoreOnUnmount && originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
    };
  }, [title, restoreOnUnmount, appendSiteName, siteName]);

  useEffect(() => {
    if (description) {
      // Find or create meta description tag
      let metaDescription = document.querySelector(
        'meta[name="description"]'
      ) as HTMLMetaElement;

      if (!metaDescription) {
        metaDescription = document.createElement("meta");
        metaDescription.name = "description";
        document.head.appendChild(metaDescription);
      }

      // Store the original description on first mount
      if (originalDescriptionRef.current === null) {
        originalDescriptionRef.current = metaDescription.content || "";
      }

      // Replace {siteName} placeholder in description
      let fullDescription = description;
      if (description.includes("{siteName}")) {
        fullDescription = description.replace("{siteName}", siteName);
      }

      // Set the new description
      metaDescription.content = fullDescription;

      // Cleanup function to restore original description
      return () => {
        if (restoreOnUnmount && originalDescriptionRef.current !== null) {
          metaDescription.content = originalDescriptionRef.current;
        }
      };
    }
  }, [description, restoreOnUnmount, siteName]);
}
