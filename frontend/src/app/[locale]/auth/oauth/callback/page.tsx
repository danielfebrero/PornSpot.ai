"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { Button } from "@/components/ui/Button";
import { userApi } from "@/lib/api";
import { invalidateQueries } from "@/lib/queryClient";
import useGoogleAuth from "@/hooks/useGoogleAuth";
import { useReturnUrl } from "@/contexts/ReturnUrlContext";
import { useUserContext } from "@/contexts/UserContext";
import { useTranslations } from "next-intl";

type CallbackState = "loading" | "success" | "error";

function OAuthCallbackContent() {
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("");
  const [isAnimated, setIsAnimated] = useState(false);
  const t = useTranslations("auth.oauth.callback");
  const { validateOAuthState, clearOAuthState, getStoredReturnUrl } =
    useGoogleAuth();
  const { getReturnUrl, clearReturnUrl } = useReturnUrl();
  const { checkAuth } = useUserContext();
  const searchParams = useSearchParams();
  const router = useLocaleRouter();
  const isProcessingRef = useRef(false);
  const hasProcessedRef = useRef(false);

  // Trigger animation after component mounts
  useEffect(() => {
    const animationTimer = setTimeout(() => {
      setIsAnimated(true);
    }, 100);

    return () => clearTimeout(animationTimer);
  }, []);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const code = searchParams.get("code");
      const stateParam = searchParams.get("state");
      const error = searchParams.get("error");

      // Create a unique key for this OAuth request
      const requestKey = `oauth_processed_${stateParam || code}`;

      // Check if we've already processed this exact OAuth request
      if (typeof window !== "undefined") {
        const alreadyProcessed = sessionStorage.getItem(requestKey);
        if (alreadyProcessed) {
          console.log(
            "OAuth callback already processed for this request, skipping"
          );
          return;
        }
        // Mark this request as being processed
        sessionStorage.setItem(requestKey, "processing");
      }

      // Prevent multiple simultaneous calls
      if (isProcessingRef.current || hasProcessedRef.current) {
        console.log(
          "OAuth callback already processed or in progress, skipping"
        );
        return;
      }

      try {
        isProcessingRef.current = true;

        // Handle OAuth error from Google
        if (error) {
          setState("error");
          setMessage(`OAuth error: ${error}`);
          hasProcessedRef.current = true;

          // Mark as processed with error
          if (typeof window !== "undefined") {
            sessionStorage.setItem(requestKey, "error");
          }
          return;
        }

        // Check for required parameters
        if (!code) {
          setState("error");
          setMessage(t("missingAuthCode"));
          hasProcessedRef.current = true;

          // Mark as processed with error
          if (typeof window !== "undefined") {
            sessionStorage.setItem(requestKey, "error");
          }
          return;
        }

        // Validate OAuth state parameter for security (but don't block on failure)
        if (stateParam && !validateOAuthState(stateParam)) {
          console.warn(
            "OAuth state validation failed, but continuing with backend validation"
          );
          console.warn("State validation details:", {
            receivedState: stateParam,
            storedState:
              typeof window !== "undefined"
                ? sessionStorage.getItem("google_oauth_state")
                : null,
          });
        } else if (stateParam) {
          console.log("OAuth state validation passed");
        }

        // Exchange authorization code for tokens
        const response = await userApi.googleOAuthCallback(
          code,
          stateParam || undefined
        );

        if (response.user) {
          setState("success");
          setMessage(t("successfullySignedIn"));

          // Get stored return URL from both sources (priority to new context)
          const contextReturnUrl = getReturnUrl(false); // Don't clear yet
          const legacyReturnUrl = getStoredReturnUrl();
          const storedReturnTo = contextReturnUrl || legacyReturnUrl;

          // Clear all OAuth state and return URLs
          clearOAuthState();
          clearReturnUrl();

          // Invalidate user cache to refresh authentication state
          invalidateQueries.user();

          // Wait for authentication state to be refreshed
          await checkAuth();

          hasProcessedRef.current = true;

          // Mark as successfully processed
          if (typeof window !== "undefined") {
            sessionStorage.setItem(requestKey, "completed");
          }

          // Redirect to stored return URL or backend suggested URL or default success page
          const redirectUrl =
            storedReturnTo || response?.redirectUrl || "/auth/success";
          router.push(redirectUrl);
        } else {
          setState("error");
          setMessage(t("oauthFailed"));
          hasProcessedRef.current = true;

          // Mark as processed with error
          if (typeof window !== "undefined") {
            sessionStorage.setItem(requestKey, "error");
          }
        }
      } catch (err) {
        setState("error");
        setMessage(err instanceof Error ? err.message : t("unexpectedError"));
        hasProcessedRef.current = true;

        // Mark as processed with error
        if (typeof window !== "undefined") {
          sessionStorage.setItem(requestKey, "error");
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    handleOAuthCallback();
  }, [
    searchParams,
    validateOAuthState,
    clearOAuthState,
    getStoredReturnUrl,
    getReturnUrl,
    clearReturnUrl,
    checkAuth,
    router,
    t,
  ]);

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-6 transition-all duration-700 transform ${
                isAnimated ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            >
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <h2
              className={`text-2xl font-bold text-foreground mb-2 transition-all duration-700 delay-200 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {t("completingSignIn")}
            </h2>

            <p
              className={`text-muted-foreground text-lg transition-all duration-700 delay-300 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {t("pleaseWaitGoogle")}
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 mb-6 transition-all duration-700 transform ${
                isAnimated ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            >
              <svg
                className="w-10 h-10 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2
              className={`text-2xl font-bold text-foreground mb-2 transition-all duration-700 delay-200 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {t("welcomeBack")}
            </h2>

            <p
              className={`text-muted-foreground text-lg mb-4 transition-all duration-700 delay-300 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {message}
            </p>

            <p
              className={`text-sm text-muted-foreground transition-all duration-700 delay-400 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {t("redirectingDashboard")}
            </p>

            <div
              className={`flex items-center justify-center space-x-2 mt-4 transition-all duration-700 delay-500 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        );

      case "error":
        return (
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 mb-6 transition-all duration-700 transform ${
                isAnimated ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            >
              <svg
                className="w-10 h-10 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <h2
              className={`text-2xl font-bold text-foreground mb-2 transition-all duration-700 delay-200 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {t("authenticationFailed")}
            </h2>

            <p
              className={`text-muted-foreground text-lg mb-4 transition-all duration-700 delay-300 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              {message}
            </p>

            {/* Error Details Card */}
            <div
              className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 transition-all duration-700 delay-400 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="text-xl">💡</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground text-sm mb-1">
                    {t("whatCanYouDo")}
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• {t("trySignInAgain")}</li>
                    <li>• {t("allowPermissions")}</li>
                    <li>• {t("checkBlockedPopups")}</li>
                    <li>• {t("clearCookies")}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div
              className={`space-y-3 transition-all duration-700 delay-500 transform ${
                isAnimated
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
            >
              <Button
                onClick={() => router.push("/auth/login")}
                className="w-full max-w-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {t("tryAgain")}
              </Button>

              <button
                onClick={() => router.push("/")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("goToDiscover")}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
}

export default function OAuthCallbackPage() {
  const t = useTranslations("auth.oauth.callback");

  return (
    <Suspense
      fallback={
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-6">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t("processingAuthentication")}
          </h2>

          <p className="text-muted-foreground text-lg">
            {t("pleaseWaitProcess")}
          </p>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
