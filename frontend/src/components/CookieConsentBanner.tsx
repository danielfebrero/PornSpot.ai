"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { LocaleLink } from "@/components/ui/LocaleLink";

const COOKIE_NAME = "psa_cookie_consent";

export function CookieConsentBanner() {
  const t = useTranslations("cookieBanner");
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const consentValue = getCookie(COOKIE_NAME);
    if (!consentValue) {
      setVisible(true);
    }
    setMounted(true);
  }, []);

  const handleAccept = () => {
    setCookie(COOKIE_NAME, "1", 365);
    setVisible(false);
  };

  if (!mounted || !visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto flex w-full max-w-4xl gap-3 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm flex-row items-center justify-between">
        <p className="text-sm text-muted-foreground text-left">
          {t.rich("message", {
            link: (chunks) => (
              <LocaleLink
                href="/privacy"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {chunks}
              </LocaleLink>
            ),
          })}
        </p>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAccept}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function setCookie(name: string, value: string, days: number) {
  try {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "; expires=" + date.toUTCString();
    document.cookie = `${name}=${value}${expires}; path=/; SameSite=Lax`;
  } catch (error) {
    // ignore cookie write errors
  }
}

function getCookie(name: string): string | undefined {
  try {
    const match = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
          name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") +
          "=([^;]*)"
      )
    );
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch (error) {
    return undefined;
  }
}
