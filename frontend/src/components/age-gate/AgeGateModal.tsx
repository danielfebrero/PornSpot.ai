"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

interface AgeGateModalProps {
  onAccept: () => void;
  onDeny: () => void;
}

export function AgeGateModal({ onAccept, onDeny }: AgeGateModalProps) {
  const t = useTranslations("ageGate.modal");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center space-y-3">
          <h2 className="text-2xl font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("description")}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={onAccept} className="w-full font-medium">
            {t("continueButton")}
          </Button>
          <Button
            onClick={onDeny}
            variant="outline"
            className="w-full font-medium"
          >
            {t("denyButton")}
          </Button>
        </div>
        <p className="mt-4 text-[11px] text-center text-muted-foreground leading-snug">
          {t("disclaimer")}
        </p>
      </div>
    </div>,
    document.body
  );
}
