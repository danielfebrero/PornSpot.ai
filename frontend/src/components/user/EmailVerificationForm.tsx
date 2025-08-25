"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { userApi } from "@/lib/api";
import { useLocaleRouter } from "@/lib/navigation";

type VerificationFormData = {
  code: string;
};

interface EmailVerificationFormProps {
  email: string;
}

export function EmailVerificationForm({ email }: EmailVerificationFormProps) {
  const t = useTranslations("auth.verification");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const router = useLocaleRouter();

  const verificationSchema = z.object({
    code: z.string().min(1, t("codeRequired")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
  });

  const onSubmit = async (data: VerificationFormData) => {
    setError(null);
    setSuccess(null);
    try {
      const response = await userApi.verifyEmail(data.code);
      if (response.user) {
        setSuccess(t("emailVerified"));
        router.push("/user/profile");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || t("invalidCode"));
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    setIsResending(true);
    try {
      await userApi.resendVerification(email);
      setSuccess(t("emailSent"));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(
        error.response?.data?.error || t("resendFailed")
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {t("verifyEmail")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("checkEmail")} {email}.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register("code")}
          label={t("codeLabel")}
          placeholder={t("codePlaceholder")}
          error={errors.code?.message}
          disabled={isSubmitting}
        />

        {error && (
          <div className="text-sm text-destructive text-center">{error}</div>
        )}
        {success && (
          <div className="text-sm text-green-500 text-center">{success}</div>
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t("verify")}
        </Button>
      </form>

      <Button
        variant="link"
        className="w-full"
        onClick={handleResend}
        loading={isResending}
      >
        {t("resendEmail")}
      </Button>
    </div>
  );
}
