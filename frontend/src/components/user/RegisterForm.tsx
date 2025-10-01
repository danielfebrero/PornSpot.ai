"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocaleRouter } from "@/lib/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleLoginButton } from "./GoogleLoginButton";
import { useRegister } from "@/hooks/queries/useUserQuery";
import { UserRegistrationFormData } from "@/types/user";
import { userApi } from "@/lib/api";
import LocaleLink from "@/components/ui/LocaleLink";
import { useReturnUrl } from "@/contexts/ReturnUrlContext";
import { Card, CardContent } from "@/components/ui/Card";

// Validation schema
type Translator = ReturnType<typeof useTranslations>;

const createRegisterSchema = (tAuth: Translator) =>
  z
    .object({
      email: z
        .string()
        .min(1, tAuth("validation.emailRequired"))
        .email(tAuth("validation.emailInvalid")),
      password: z
        .string()
        .min(8, tAuth("validation.passwordTooShort"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          tAuth("messages.passwordRequirements")
        ),
      confirmPassword: z
        .string()
        .min(1, tAuth("validation.confirmPasswordRequired")),
      username: z
        .string()
        .min(3, tAuth("validation.usernameTooShort"))
        .max(30, tAuth("messages.usernameTooLong"))
        .regex(/^[a-zA-Z0-9_-]+$/, tAuth("validation.usernameInvalid")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tAuth("validation.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });

// Username availability states
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "error";

export function RegisterForm() {
  const registerMutation = useRegister();
  const loading = registerMutation.isPending;
  const error = registerMutation.error?.message || null;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const router = useLocaleRouter();
  const { setReturnUrl, getReturnUrl } = useReturnUrl();

  const tAuth = useTranslations("auth");

  const urlReturnTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo")
      : null;

  const storedReturnUrl = getReturnUrl(false);
  const returnTo = urlReturnTo || storedReturnUrl;

  useEffect(() => {
    if (urlReturnTo) {
      setReturnUrl(urlReturnTo);
    }
  }, [setReturnUrl, urlReturnTo]);

  const registerSchema = createRegisterSchema(tAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    watch,
  } = useForm<UserRegistrationFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
    },
  });

  const watchedEmail = watch("email");
  const watchedUsername = watch("username");

  // Debounced username availability checking
  const checkUsernameAvailability = useCallback(
    async (username: string) => {
      if (!username || username.length < 3) {
        setUsernameStatus("idle");
        setUsernameMessage("");
        return;
      }

      // Check format first
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        setUsernameStatus("error");
        setUsernameMessage(tAuth("messages.usernameInvalidChars"));
        return;
      }

      if (username.length > 30) {
        setUsernameStatus("error");
        setUsernameMessage(tAuth("messages.usernameTooLong"));
        return;
      }

      setUsernameStatus("checking");
      setUsernameMessage(tAuth("messages.checkingAvailability"));

      try {
        const response = await userApi.checkUsernameAvailability({ username });

        if (response.available) {
          setUsernameStatus("available");
          setUsernameMessage(tAuth("messages.usernameAvailable"));
        } else {
          setUsernameStatus("taken");
          setUsernameMessage(
            response.message || tAuth("messages.usernameAlreadyTaken")
          );
        }
      } catch (error) {
        setUsernameStatus("error");
        setUsernameMessage(
          error instanceof Error
            ? error.message
            : tAuth("failedToCheckUsernameAvailability")
        );
      }
    },
    [tAuth]
  );

  // Debounce username checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (watchedUsername) {
        checkUsernameAvailability(watchedUsername);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedUsername, checkUsernameAvailability]);

  const onSubmit = async (data: UserRegistrationFormData) => {
    try {
      registerMutation.reset(); // Clear previous errors

      // Final username availability check before submission
      if (usernameStatus === "taken") {
        setFormError("username", {
          type: "manual",
          message: tAuth("messages.usernameAlreadyTaken"),
        });
        return;
      }

      if (usernameStatus === "checking") {
        setFormError("username", {
          type: "manual",
          message: tAuth("messages.waitForUsernameCheck"),
        });
        return;
      }

      const result = await registerMutation.mutateAsync({
        email: data.email,
        password: data.password,
        username: data.username,
      });

      if (!!result) {
        setRegistrationSuccess(true);
      } else {
        setFormError("root", {
          type: "manual",
          message: error || tAuth("registrationFailedTryAgain"),
        });
      }
    } catch (err) {
      setFormError("root", {
        type: "manual",
        message:
          err instanceof Error ? err.message : tAuth("unexpectedErrorOccurred"),
      });
    }
  };

  const isLoading = loading || isSubmitting;
  const loginHref = returnTo
    ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/login";

  const handleGoToSignIn = () => {
    if (returnTo) {
      setReturnUrl(returnTo);
    }
    router.push(loginHref);
  };

  // Show success message after registration
  if (registrationSuccess) {
    return (
      <div className="flex justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
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

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {tAuth("messages.registrationSuccessful")}
              </h2>
              <p className="text-muted-foreground mt-2">
                {tAuth("messages.welcomeMessage")}{" "}
                <span className="font-medium text-foreground">
                  {watchedEmail}
                </span>{" "}
                {tAuth("messages.toVerifyAccount")}
              </p>
            </div>

            <div className="space-y-3">
              <Button onClick={handleGoToSignIn} className="w-full">
                {tAuth("messages.goToSignIn")}
              </Button>

              <button
                onClick={() => setRegistrationSuccess(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {tAuth("messages.backToRegistration")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">
              {tAuth("messages.createYourAccount")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {tAuth("messages.joinMessage")}
            </p>
          </div>

          {/* Google OAuth first */}
          <GoogleLoginButton
            disabled={isLoading}
            returnTo={returnTo || undefined}
          />

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
            <div className="relative">
              <Input
                {...register("username")}
                type="text"
                label={tAuth("labels.username")}
                placeholder={tAuth("placeholders.chooseUsername")}
                error={errors.username?.message}
                disabled={isLoading}
                autoComplete="username"
                required
              />

              {/* Username availability indicator */}
              {watchedUsername && watchedUsername.length >= 3 && (
                <div className="absolute right-3 top-8 flex items-center h-10">
                  {usernameStatus === "checking" && (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  )}
                  {usernameStatus === "available" && (
                    <svg
                      className="w-4 h-4 text-green-600"
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
                  )}
                  {usernameStatus === "taken" && (
                    <svg
                      className="w-4 h-4 text-red-600"
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
                  )}
                  {usernameStatus === "error" && (
                    <svg
                      className="w-4 h-4 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  )}
                </div>
              )}

              {/* Username status message */}
              {usernameMessage && (
                <div
                  className={`text-xs mt-1 ${
                    usernameStatus === "available"
                      ? "text-green-600"
                      : usernameStatus === "taken"
                      ? "text-red-600"
                      : usernameStatus === "error"
                      ? "text-yellow-600"
                      : "text-gray-500"
                  }`}
                >
                  {usernameMessage}
                </div>
              )}
            </div>

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
                placeholder={tAuth("placeholders.createPassword")}
                error={errors.password?.message}
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
                label={tAuth("labels.confirmPassword")}
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

            <div className="text-xs text-muted-foreground space-y-1">
              <div>{tAuth("messages.passwordRequirements")}</div>
              <div>{tAuth("messages.usernameRequirements")}</div>
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
              {tAuth("createAccount")}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {tAuth("alreadyHaveAccount")}{" "}
            </span>
            <LocaleLink
              href={loginHref}
              className="text-primary hover:text-primary/90 font-medium"
            >
              {tAuth("signIn")}
            </LocaleLink>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            {tAuth("messages.byCreatingAccount")}{" "}
            <LocaleLink
              href="/terms"
              className="text-primary hover:text-primary/90"
            >
              Terms of Service
            </LocaleLink>{" "}
            and{" "}
            <LocaleLink
              href="/privacy"
              className="text-primary hover:text-primary/90"
            >
              Privacy Policy
            </LocaleLink>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegisterForm;
