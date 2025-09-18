"use client";

import { useTranslations } from "next-intl";

interface KidViewProps {
  onBack: () => void;
}

export function KidView({ onBack }: KidViewProps) {
  const t = useTranslations("ageGate.kidView");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 text-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="mx-auto w-40 h-40">
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full"
            role="img"
            aria-label="Underage Illustration"
          >
            <circle cx="100" cy="100" r="95" fill="url(#grad)" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="85" r="12" fill="#fff" />
            <circle cx="120" cy="85" r="12" fill="#fff" />
            <circle cx="80" cy="85" r="6" fill="#1e3a8a" />
            <circle cx="120" cy="85" r="6" fill="#1e3a8a" />
            <path
              d="M70 125 Q100 145 130 125"
              stroke="#1e3a8a"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M55 65 Q100 35 145 65"
              stroke="#1e3a8a"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("description")}
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors w-full"
        >
          {t("backButton")}
        </button>
      </div>
    </div>
  );
}
