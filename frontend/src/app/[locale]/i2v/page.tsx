"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useDocumentHeadAndMeta } from "@/hooks/useDocumentHeadAndMeta";
import { I2VPageContent } from "@/components/i2v/I2VPageContent";

export default function I2VPage() {
  const t = useTranslations("i2v");

  // Set document title and meta description
  useDocumentHeadAndMeta(t("meta.title"), t("meta.description"));

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <I2VPageContent />
    </Suspense>
  );
}
