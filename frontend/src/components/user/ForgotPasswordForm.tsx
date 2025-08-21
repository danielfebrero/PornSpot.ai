"use client";

import { useState } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import LocaleLink from "@/components/ui/LocaleLink";
import { userApi } from "@/lib/api";
import { ForgotPasswordRequest } from "@/types";

// Validation schema with internationalization
const createForgotPasswordSchema = (tAuth: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, tAuth("validation.emailRequired"))
      .email(tAuth("validation.emailInvalid")),
  });

export function ForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tForgot = useTranslations("auth.forgotPassword");

  const forgotPasswordSchema = createForgotPasswordSchema(tAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordRequest) => {
    try {
      setError(null);
      setLoading(true);

      await userApi.forgotPassword({
        email: data.email,
      });

      setIsSubmitted(true);
    } catch (err) {
      console.error("Forgot password error:", err);
      const errorMessage = err instanceof Error ? err.message : t("error");
      setFormError("root", {
        type: "manual",
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || isSubmitting;

  if (isSubmitted) {
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
            {tForgot("emailSent")}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {tForgot("emailSentMessage")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {tForgot("checkEmail")}
          </p>
        </div>

        <div className="text-center">
          <LocaleLink
            href="/auth/login"
            className="text-primary hover:text-primary/90 font-medium"
          >
            {tForgot("backToLogin")}
          </LocaleLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {tForgot("title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tForgot("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register("email")}
          type="email"
          label={tAuth("labels.email")}
          placeholder={tAuth("placeholders.enterEmail")}
          error={errors.email?.message}
          disabled={isLoading}
          autoComplete="email"
          required
        />

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
          {tForgot("sendResetLink")}
        </Button>
      </form>

      <div className="text-center">
        <LocaleLink
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tForgot("backToLogin")}
        </LocaleLink>
      </div>
    </div>
  );
}

export default ForgotPasswordForm;
