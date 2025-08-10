"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocaleRouter } from "@/lib/navigation";
import { Button } from "@/components/ui/Button";
import {
  useUserProfile,
  useVerifyEmail,
  useCheckAuth,
} from "@/hooks/queries/useUserQuery";

type VerificationState = "loading" | "success" | "error" | "invalid";

export function VerifyEmailClient() {
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("");
  const { data: userProfile } = useUserProfile();
  const user = userProfile?.user || null;
  const verifyEmailMutation = useVerifyEmail();
  const checkAuthMutation = useCheckAuth();
  const searchParams = useSearchParams();
  const router = useLocaleRouter();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setState("invalid");
      setMessage("Invalid verification link. No token provided.");
      return;
    }

    const performVerification = async () => {
      try {
        const result = await verifyEmailMutation.mutateAsync(token);
        if (!result) {
          setMessage(
            "Email verification failed. The link may be expired or invalid."
          );
        }

        setState("success");
        setMessage(
          "Your email has been successfully verified and you're now signed in!"
        );

        await checkAuthMutation.mutateAsync();
      } catch (err) {
        setState("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during verification."
        );
      }
    };

    performVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, verifyEmailMutation, checkAuthMutation]); // Updated dependencies

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
              Verifying your email...
            </h2>
            <p className="text-muted-foreground">
              Please wait while we verify your email address.
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
                Email Verified!
              </h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground">
                Your account is now fully activated and you&apos;re
                automatically signed in. You can now access all features.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleGoHome} className="px-6">
                  Go to Homepage
                </Button>
                {!user && (
                  <Button
                    variant="outline"
                    onClick={handleGoToLogin}
                    className="px-6"
                  >
                    Login to Your Account
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
                Verification Failed
              </h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground">
                Please try requesting a new verification email or contact
                support if the problem persists.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleGoHome} className="px-6">
                  Go to Homepage
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoToLogin}
                  className="px-6"
                >
                  Back to Login
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
                Invalid Link
              </h2>
              <p className="text-muted-foreground text-lg">{message}</p>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground">
                Please make sure you&apos;re using the complete verification
                link from your email.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleGoHome} className="px-6">
                  Go to Homepage
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoToLogin}
                  className="px-6"
                >
                  Back to Login
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
