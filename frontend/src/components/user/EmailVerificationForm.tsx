"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { userApi } from "@/lib/api";
import { useLocaleRouter } from "@/lib/navigation";

const verificationSchema = z.object({
  code: z.string().min(1, "Verification code is required"),
});

type VerificationFormData = z.infer<typeof verificationSchema>;

interface EmailVerificationFormProps {
  email: string;
}

export function EmailVerificationForm({ email }: EmailVerificationFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const router = useLocaleRouter();

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
      if (response.success && response.data?.user) {
        setSuccess(
          "Email verified successfully! You're now signed in. Redirecting to profile..."
        );
        router.push("/user/profile");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Invalid verification code.");
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    setIsResending(true);
    try {
      await userApi.resendVerification(email);
      setSuccess("A new verification email has been sent.");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(
        error.response?.data?.error || "Failed to resend verification email."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Verify Your Email
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          You must verify your email before you can log in. A verification code
          has been sent to {email}.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register("code")}
          label="Verification Code"
          placeholder="Enter the code"
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
          Verify
        </Button>
      </form>

      <Button
        variant="link"
        className="w-full"
        onClick={handleResend}
        loading={isResending}
      >
        Resend verification email
      </Button>
    </div>
  );
}
