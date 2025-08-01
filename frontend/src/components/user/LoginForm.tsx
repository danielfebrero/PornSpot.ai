"use client";

import { useState } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleLoginButton } from "./GoogleLoginButton";
import { useUser } from "@/hooks/useUser";
import { UserLoginFormData } from "@/types/user";
import LocaleLink from "@/components/ui/LocaleLink";
import { EmailVerificationForm } from "./EmailVerificationForm";

// Validation schema with internationalization
const createLoginSchema = (tAuth: any) =>
  z.object({
    email: z
      .string()
      .min(1, tAuth("validation.emailRequired"))
      .email(tAuth("validation.emailInvalid")),
    password: z
      .string()
      .min(1, tAuth("validation.passwordRequired"))
      .min(6, tAuth("validation.passwordTooShort")),
  });

export function LoginForm() {
  const { login, loading, error, clearError, emailVerificationRequired } =
    useUser();
  const [showPassword, setShowPassword] = useState(false);
  const router = useLocaleRouter();

  const t = useTranslations("common");
  const tAuth = useTranslations("auth");

  // Get returnTo parameter from URL
  const returnTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo")
      : null;

  const loginSchema = createLoginSchema(tAuth);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError: setFormError,
  } = useForm<UserLoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const email = watch("email");

  const onSubmit = async (data: UserLoginFormData) => {
    try {
      clearError();

      const success = await login({
        email: data.email,
        password: data.password,
      });

      if (success) {
        // Redirect to returnTo URL if provided, otherwise to home page
        const redirectUrl = returnTo || "/";
        router.push(redirectUrl);
      } else if (!emailVerificationRequired) {
        setFormError("root", {
          type: "manual",
          message: error || tAuth("errors.loginFailed"),
        });
      }
    } catch (err) {
      setFormError("root", {
        type: "manual",
        message: err instanceof Error ? err.message : t("error"),
      });
    }
  };

  const isLoading = loading || isSubmitting;

  if (emailVerificationRequired) {
    return <EmailVerificationForm email={email} />;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {tAuth("signInToAccount")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tAuth("welcomeBack")}
        </p>
      </div>

      <GoogleLoginButton disabled={isLoading} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {tAuth("messages.orContinueWith")} Email
          </span>
        </div>
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

        <div className="relative">
          <Input
            {...register("password")}
            type={showPassword ? "text" : "password"}
            label={tAuth("labels.password")}
            placeholder={tAuth("placeholders.enterPassword")}
            error={errors.password?.message}
            disabled={isLoading}
            autoComplete="current-password"
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
          {tAuth("signIn")}
        </Button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">
          {tAuth("dontHaveAccount")}{" "}
        </span>
        <LocaleLink
          href="/auth/register"
          className="text-primary hover:text-primary/90 font-medium"
        >
          {tAuth("signUp")}
        </LocaleLink>
      </div>

      <div className="text-center">
        <LocaleLink
          href="/auth/forgot-password"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tAuth("forgotPassword")}
        </LocaleLink>
      </div>
    </div>
  );
}

export default LoginForm;
