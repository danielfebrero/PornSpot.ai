"use client";

import { useEffect, useRef } from "react";

/**
 * Custom hook to manage document title with proper cleanup
 *
 * This hook provides a React-friendly way to set the document title
 * and automatically restores the previous title when the component unmounts.
 *
 * @param title - The title to set for the document
 * @param options - Configuration options
 * @param options.restoreOnUnmount - Whether to restore the previous title on unmount (default: true)
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const t = useTranslations("user.likes");
 *   useDocumentTitle(t("meta.title"));
 *
 *   return <div>My page content</div>;
 * }
 * ```
 */
export function useDocumentTitle(
  title: string,
  options: {
    restoreOnUnmount?: boolean;
  } = {}
) {
  const { restoreOnUnmount = true } = options;
  const originalTitleRef = useRef<string | null>(null);

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
}
