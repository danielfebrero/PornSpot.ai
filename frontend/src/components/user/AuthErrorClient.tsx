"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import LocaleLink from "@/components/ui/LocaleLink";

export function AuthErrorClient() {
  const searchParams = useSearchParams();
  const [isAnimated, setIsAnimated] = useState(false);
  const tAuth = useTranslations("auth.error");

  const errorMessage = searchParams.get("error") || tAuth("unknownError");

  useEffect(() => {
    // Trigger animation after component mounts
    const animationTimer = setTimeout(() => {
      setIsAnimated(true);
    }, 100);

    return () => {
      clearTimeout(animationTimer);
    };
  }, []);

  function getErrorTitle(error: string): string {
    switch (error) {
      case "auth_cancelled":
        return "authCancelled";
      case "auth_failed":
        return "authFailed";
      case "auth_error":
        return "authError";
      default:
        return "somethingWentWrong";
    }
  }

  const getErrorIcon = (error: string) => {
    if (error.includes("cancelled") || error.includes("access_denied")) {
      return "⏸️";
    }
    return "⚠️";
  };

  return (
    <div className="space-y-8">
      {/* Error Icon with Animation */}
      <div className="text-center">
        <div
          className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 mb-6 transition-all duration-700 transform ${
            isAnimated ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <span className="text-3xl">{getErrorIcon(errorMessage)}</span>
        </div>

        <h2
          className={`text-2xl font-bold text-foreground mb-2 transition-all duration-700 delay-200 transform ${
            isAnimated ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {tAuth(getErrorTitle(errorMessage))}
        </h2>

        <p
          className={`text-muted-foreground mb-6 transition-all duration-700 delay-300 transform ${
            isAnimated ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {errorMessage}
        </p>

        {/* Error Details Card */}
        <div
          className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 transition-all duration-700 delay-400 transform ${
            isAnimated ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground text-sm mb-1">
                {tAuth("whatCanYouDo")}
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {tAuth("tryDifferentMethod")}</li>
                <li>• {tAuth("allowPermissions")}</li>
                <li>• {tAuth("checkBlockedPopups")}</li>
                <li>• {tAuth("clearCookies")}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className={`space-y-3 transition-all duration-700 delay-500 transform ${
          isAnimated ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <LocaleLink href="/auth/login" className="block">
          <Button
            variant="primary"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {tAuth("tryAgain")}
          </Button>
        </LocaleLink>

        <LocaleLink href="/auth/register" className="block">
          <Button variant="outline" className="w-full">
            {tAuth("createNewAccount")}
          </Button>
        </LocaleLink>

        <LocaleLink href="/" className="block">
          <Button variant="ghost" className="w-full">
            {tAuth("backToDiscover")}
          </Button>
        </LocaleLink>
      </div>

      {/* Support Info */}
      <div
        className={`text-center text-sm text-muted-foreground border-t border-border pt-4 transition-all duration-700 delay-600 transform ${
          isAnimated ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <p>
          {tAuth("stillTrouble")}{" "}
          <LocaleLink
            href="/contact"
            className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          >
            {tAuth("contactSupport")}
          </LocaleLink>
        </p>
      </div>
    </div>
  );
}
