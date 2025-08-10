"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { userApi } from "@/lib/api";

// Username availability states
export type UsernameStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "error";

export interface UseUsernameAvailabilityReturn {
  usernameStatus: UsernameStatus;
  usernameMessage: string;
  checkUsernameAvailability: (
    username: string,
    currentUsername?: string
  ) => Promise<void>;
  resetStatus: () => void;
}

/**
 * Custom hook for checking username availability
 * Provides username validation and availability checking with debouncing
 */
export function useUsernameAvailability(): UseUsernameAvailabilityReturn {
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  const tAuth = useTranslations("auth");

  const checkUsernameAvailability = useCallback(
    async (username: string, currentUsername?: string) => {
      // Skip checking if it's the current user's existing username
      if (currentUsername && username === currentUsername) {
        setUsernameStatus("idle");
        setUsernameMessage("");
        return;
      }

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
          error instanceof Error ? error.message : "Failed to check username availability"
        );
      }
    },
    [tAuth]
  );

  const resetStatus = useCallback(() => {
    setUsernameStatus("idle");
    setUsernameMessage("");
  }, []);

  return {
    usernameStatus,
    usernameMessage,
    checkUsernameAvailability,
    resetStatus,
  };
}

export default useUsernameAvailability;
