"use client";

import { useEffect, useRef } from "react";

/**
 * Custom hook to manage document title and meta description with proper cleanup
 *
 * This hook provides a React-friendly way to set the document title and meta description
 * and automatically restores the previous values when the component unmounts.
 *
 * @param title - The title to set for the document
 * @param description - The description to set for the meta description tag (optional)
 * @param options - Configuration options
 * @param options.restoreOnUnmount - Whether to restore the previous title and description on unmount (default: true)
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
  } = {}
) {
  const { restoreOnUnmount = true } = options;
  const originalTitleRef = useRef<string | null>(null);
  const originalDescriptionRef = useRef<string | null>(null);

  useEffect(() => {
    // Store the original title on first mount
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }

    // Set the new title
    document.title = title;

    // Cleanup function to restore original title
    return () => {
      if (restoreOnUnmount && originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
    };
  }, [title, restoreOnUnmount]);

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

      // Set the new description
      metaDescription.content = description;

      // Cleanup function to restore original description
      return () => {
        if (restoreOnUnmount && originalDescriptionRef.current !== null) {
          metaDescription.content = originalDescriptionRef.current;
        }
      };
    }
  }, [description, restoreOnUnmount]);
}
