"use client";

import { Suspense } from "react";
import { I2VPageContent } from "@/components/i2v/I2VPageContent";

export default function I2VPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <I2VPageContent />
    </Suspense>
  );
}
