"use client";

import { useState, useEffect } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import LocaleLink from "@/components/ui/LocaleLink";
import { userApi } from "@/lib/api";
import { useUserContext } from "@/contexts/UserContext";

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

// Validation schema with internationalization
const createResetPasswordSchema = (tAuth: (key: string) => string) =>
  z
    .object({
      newPassword: z
        .string()
        .min(1, tAuth("validation.passwordRequired"))
        .min(8, tAuth("validation.passwordTooShort"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
          tAuth("messages.passwordRequirements")
        ),
      confirmPassword: z.string().min(1, tAuth("validation.passwordRequired")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: tAuth("validation.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useLocaleRouter();
  const { checkAuth } = useUserContext();

  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tReset = useTranslations("auth.resetPassword");

  const resetPasswordSchema = createResetPasswordSchema(tAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    // Extract token from URL params
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get("token");
      if (tokenParam) {
        setToken(tokenParam);
      } else {
        setTokenError(true);
      }
    }
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setTokenError(true);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      await userApi.resetPassword({
        token,
        newPassword: data.newPassword,
      });

      // If successful, the user is automatically logged in
      setIsSuccess(true);

      // Wait for authentication state to be refreshed
      await checkAuth();

      // Redirect to home page after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      const errorMessage = err instanceof Error ? err.message : t("error");

      // Check if it's a token error
      if (
        errorMessage.includes("token") ||
        errorMessage.includes("expired") ||
        errorMessage.includes("invalid")
      ) {
        setTokenError(true);
      } else {
        setFormError("root", {
          type: "manual",
          message: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || isSubmitting;

  // Token error state
  if (tokenError || (!token && typeof window !== "undefined")) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
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
          <h2 className="text-xl font-semibold text-foreground">
            {tReset("invalidToken")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {tReset("invalidTokenMessage")}
          </p>
        </div>

        <div className="text-center space-y-2">
          <LocaleLink
            href="/auth/forgot-password"
            className="block text-primary hover:text-primary/90 font-medium"
          >
            {tReset("requestNewLink")}
          </LocaleLink>
          <LocaleLink
            href="/auth/login"
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            {tAuth("signIn")}
          </LocaleLink>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
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
          <h2 className="text-xl font-semibold text-foreground">
            {tReset("resetSuccess")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {tReset("resetSuccessMessage")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Redirecting to home page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {tReset("title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tReset("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="relative">
          <Input
            {...register("newPassword")}
            type={showPassword ? "text" : "password"}
            label={tReset("newPassword")}
            placeholder={tAuth("placeholders.createPassword")}
            error={errors.newPassword?.message}
            disabled={isLoading}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            {showPassword ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>

        <div className="relative">
          <Input
            {...register("confirmPassword")}
            type={showConfirmPassword ? "text" : "password"}
            label={tReset("confirmNewPassword")}
            placeholder={tAuth("placeholders.confirmPassword")}
            error={errors.confirmPassword?.message}
            disabled={isLoading}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-9 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            {showConfirmPassword ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>

        {(errors.root || error) && (
          <div className="text-sm text-destructive text-center">
            {errors.root?.message || error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {tReset("resetPassword")}
        </Button>
      </form>

      <div className="text-center">
        <LocaleLink
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tAuth("signIn")}
        </LocaleLink>
      </div>
    </div>
  );
}

export default ResetPasswordForm;
