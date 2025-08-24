"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { userApi } from "@/lib/api";

// Stars animation component
const StarsBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Generate multiple layers of stars */}
      {[...Array(100)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
            opacity: 0.3 + Math.random() * 0.7,
          }}
        />
      ))}
      {/* Larger twinkling stars */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`large-${i}`}
          className="absolute w-2 h-2 bg-gradient-to-r from-blue-300 to-purple-400 rounded-full animate-ping"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }}
        />
      ))}
      {/* Shooting stars */}
      {[...Array(5)].map((_, i) => (
        <div
          key={`shooting-${i}`}
          className="absolute w-1 h-20 bg-gradient-to-b from-white to-transparent opacity-80 animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            transform: `rotate(${45 + Math.random() * 90}deg)`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${4 + Math.random() * 6}s`,
          }}
        />
      ))}
    </div>
  );
};

interface InvitationWallProps {
  onCodeValidated: () => void;
}

export function InvitationWall({ onCodeValidated }: InvitationWallProps) {
  const t = useTranslations("invitationWall");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation schema for invitation code
  const inviteCodeSchema = z.object({
    code: z.string().min(1, t("codeRequired")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof inviteCodeSchema>>({
    resolver: zodResolver(inviteCodeSchema),
  });

  const onSubmit = async (data: z.infer<typeof inviteCodeSchema>) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await userApi.validateInviteCode(data.code);

      if (response.valid) {
        // Code is valid, proceed to registration
        onCodeValidated();
      } else {
        setError(response.message || t("invalidCodeError"));
      }
    } catch (err: any) {
      console.error("Invitation code validation error:", err);
      setError(err?.message || t("validationError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      <StarsBackground />

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="backdrop-blur-lg rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                PornSpot.ai
              </h1>
              <div className="w-20 h-1 bg-gradient-to-r from-pink-500 to-purple-500 mx-auto rounded-full"></div>
            </div>

            <h2 className="text-2xl font-semibold text-white mb-4">
              {t("title")}
            </h2>

            <div className="text-gray-300 space-y-3 mb-6">
              <p className="text-sm">{t("betaUntilDate")}</p>
              <p className="text-sm">
                {t("allUsersGetPro")}{" "}
                <span className="text-yellow-400 font-semibold">
                  {t("fullProFeatures")}
                </span>
              </p>
              <p className="text-sm">
                {t("includingUnlimited")}{" "}
                <span className="text-pink-400 font-semibold">
                  {t("unlimitedImageGeneration")}
                </span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="code"
                className="block text-sm font-medium text-gray-200"
              >
                {t("enterCodeLabel")}
              </label>
              <div className="relative">
                <Input
                  id="code"
                  type="text"
                  placeholder={t("codePlaceholder")}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all duration-300"
                  autoComplete="off"
                  {...register("code")}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl pointer-events-none opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"></div>
              </div>
              {errors.code && (
                <p className="text-red-400 text-sm">{errors.code.message}</p>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t("validatingButton")}</span>
                </div>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <span>{t("enterPortalButton")}</span>
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-xs">
              {t("needCodeText")}{" "}
              <a
                href="https://discord.gg/hU7uc84nwK"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                {t("discordLink")}
              </a>{" "}
              {t("orText")}{" "}
              <a
                href="https://reddit.com/r/fabularius"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                {t("redditLink")}
              </a>
            </p>
          </div>
        </div>

        {/* Additional magical elements */}
        <div className="absolute -top-10 -left-10 w-20 h-20 bg-gradient-to-br from-pink-400/30 to-purple-600/30 rounded-full blur-xl animate-pulse pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-2xl animate-pulse delay-1000 pointer-events-none"></div>
      </div>
    </div>
  );
}
