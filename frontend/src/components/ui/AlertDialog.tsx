"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: "info" | "success" | "warning" | "error";
  loading?: boolean;
}

export function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  confirmText = "OK",
  variant = "info",
  loading = false,
}: AlertDialogProps) {
  const t = useTranslations("common");
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          iconBg: "bg-green-100 border border-green-200",
          iconColor: "text-green-600",
          buttonClass: "bg-green-600 hover:bg-green-700 text-white",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          ),
        };
      case "warning":
        return {
          iconBg: "bg-yellow-100 border border-yellow-200",
          iconColor: "text-yellow-600",
          buttonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          ),
        };
      case "error":
        return {
          iconBg: "bg-destructive/10 border border-destructive/20",
          iconColor: "text-destructive",
          buttonClass:
            "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          ),
        };
      default: // info
        return {
          iconBg: "bg-blue-100 border border-blue-200",
          iconColor: "text-blue-600",
          buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
          icon: (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          ),
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={loading ? undefined : onClose}
        />
        <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-card border border-border p-6 shadow-2xl transition-all">
          <div className="flex items-center gap-4">
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${styles.iconBg}`}
            >
              <svg
                className={`w-6 h-6 ${styles.iconColor}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                {styles.icon}
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold leading-6 text-foreground">
                {title}
              </h3>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-muted-foreground leading-relaxed">{message}</p>
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              onClick={onClose}
              disabled={loading}
              className={`px-6 shadow-lg ${styles.buttonClass}`}
            >
              {loading ? (
                <div className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t("loading")}
                </div>
              ) : confirmText === "OK" ? (
                t("ok")
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
