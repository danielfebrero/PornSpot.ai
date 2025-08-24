"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

interface DeleteAlbumDialogProps {
  albumTitle: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteAlbumDialog({
  albumTitle,
  open,
  onClose,
  onConfirm,
  loading = false,
}: DeleteAlbumDialogProps) {
  const t = useTranslations("common");
  const tAlbums = useTranslations("albums");
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-card border border-border p-4 sm:p-6 shadow-2xl transition-all mx-4 sm:mx-0">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-destructive/10 border border-destructive/20">
              <svg
                className="w-6 h-6 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold leading-6 text-foreground">
                {tAlbums("deleteDialog.title")}
              </h3>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-muted-foreground leading-relaxed">
              {tAlbums("deleteDialog.confirmMessage")}{" "}
              <span className="font-semibold text-foreground">
                &ldquo;{albumTitle}&rdquo;
              </span>
              ?
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              {tAlbums("deleteDialog.warningMessage")}
            </p>
          </div>

          <div className="mt-8 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="px-6"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 shadow-lg"
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
                  {tAlbums("deleteDialog.deleting")}
                </div>
              ) : (
                tAlbums("actions.delete")
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
