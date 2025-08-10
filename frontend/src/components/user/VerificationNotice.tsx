"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useResendVerification } from "@/hooks/queries/useUserQuery";

interface VerificationNoticeProps {
  email: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
}

export function VerificationNotice({
  email,
  onDismiss,
  showDismiss = false,
}: VerificationNoticeProps) {
  const {
    mutateAsync: resendVerification,
    isPending: loading,
    error,
  } = useResendVerification();
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendAttempted, setResendAttempted] = useState(false);

  const handleResendVerification = async () => {
    try {
      setResendAttempted(true);

      const result = await resendVerification(email);

      if (!!result) {
        setResendSuccess(true);
      }
    } catch (err) {
      // Error is handled by the TanStack Query mutation
      console.error("Failed to resend verification:", err);
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Email Verification Required
          </h3>

          <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            <p>
              Please verify your email address to access all features. We sent a
              verification link to <span className="font-medium">{email}</span>
            </p>

            {resendSuccess && (
              <p className="mt-2 text-green-700 dark:text-green-300">
                ✓ Verification email sent successfully! Please check your inbox.
              </p>
            )}

            {error && (
              <p className="mt-2 text-red-700 dark:text-red-300">
                {error.message || "Failed to send verification email"}
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendVerification}
              loading={loading}
              disabled={loading || resendSuccess}
              className="text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-800/50"
            >
              {resendSuccess ? "Email Sent" : "Resend Email"}
            </Button>

            {showDismiss && onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800/50"
              >
                Dismiss
              </Button>
            )}
          </div>

          {resendAttempted && !resendSuccess && !error && (
            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
              <p>
                Don&apos;t see the email? Check your spam folder or try again in
                a few minutes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerificationNotice;
