"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocaleRouter } from "@/lib/navigation";
import { Button } from "@/components/ui/Button";
import { useVerifyEmail } from "@/hooks/queries/useUserQuery";
import { useUserContext } from "@/contexts/UserContext";

type VerificationState = "loading" | "success" | "error" | "invalid";

export function VerifyEmailClient() {
  const t = useTranslations("user.verifyEmail");
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("");
  const { user, checkAuth } = useUserContext();
  const verifyEmailMutation = useVerifyEmail();
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const hasVerifiedRef = useRef(false);

  const performVerification = useCallback(
    async (token: string) => {
      // Prevent multiple verification attempts
      if (hasVerifiedRef.current) {
        return;
      }

      hasVerifiedRef.current = true;

      try {
        const result = await verifyEmailMutation.mutateAsync(token);
        if (!result) {
          setState("error");
          setMessage(t("emailVerificationFailed"));
          return;
        }

        setState("success");
        setMessage(t("emailVerifiedSuccessfully"));

        await checkAuth();
      } catch (err) {
        setState("error");
        setMessage(
          err instanceof Error ? err.message : t("unexpectedErrorOccurred")
        );
      }
    },
    [verifyEmailMutation, checkAuth, t]
  );

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setState("invalid");
      setMessage(t("invalidVerificationLink"));
      return;
    }

    performVerification(token);
  }, [searchParams, performVerification]);

  const handleGoHome = () => {
    router.push("/");
  };

  const handleGoToLogin = () => {
    router.push("/auth/login");
  };

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-2xl font-bold text-foreground">
              {t("verifyingEmail")}
            </h2>
            <p className="text-muted-foreground">
              {t("pleaseWaitVerification")}
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <svg
                className="w-10 h-10 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {t("emailVerified")}
              </h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground">
                {t("accountFullyActivated")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleGoHome} className="px-6">
                  {t("goToHomepage")}
                </Button>
                {!user && (
                  <Button
                    variant="outline"
                    onClick={handleGoToLogin}
                    className="px-6"
                  >
                    {t("loginToAccount")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <svg
                className="w-10 h-10 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {t("verificationFailed")}
              </h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground">
                {t("tryRequestingNewEmail")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleGoHome} className="px-6">
                  {t("goToHomepage")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoToLogin}
                  className="px-6"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </div>
          </div>
        );

      case "invalid":
        return (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 mb-4">
              <svg
                className="w-10 h-10 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5l-6.928-12c-.77-.833-2.694-.833-3.464 0l-6.928 12c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {t("invalidLink")}
              </h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground">
                {t("makeSureCompleteLink")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleGoHome} className="px-6">
                  {t("goToHomepage")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoToLogin}
                  className="px-6"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
}
