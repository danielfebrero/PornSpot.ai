"use client";

import { useCallback, useState } from "react";
import { GoogleOAuthState } from "@/types/user";

/**
 * Custom hook for Google OAuth flow management
 */
export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate random string for OAuth state parameter
  const generateRandomString = (length: number): string => {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  };

  // Generate OAuth state and store it
  const generateOAuthState = useCallback((): GoogleOAuthState => {
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(43); // For future PKCE implementation

    // Store state in sessionStorage for validation
    if (typeof window !== "undefined") {
      sessionStorage.setItem("google_oauth_state", state);
      sessionStorage.setItem("google_oauth_code_verifier", codeVerifier);
    }

    return { state, codeVerifier };
  }, []);

  // Validate OAuth state
  const validateOAuthState = (receivedState: string): boolean => {
    if (typeof window === "undefined") return false;

    const storedState = sessionStorage.getItem("google_oauth_state");

    if (!storedState || storedState !== receivedState) {
      return false;
    }

    return true;
  };

  // Clear OAuth state after successful authentication
  const clearOAuthState = (): void => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("google_oauth_state");
      sessionStorage.removeItem("google_oauth_code_verifier");
      sessionStorage.removeItem("oauth_return_to");

      // Clean up old processed OAuth requests (keep only the last 5)
      const keys = Object.keys(sessionStorage);
      const oauthKeys = keys.filter((key) =>
        key.startsWith("oauth_processed_")
      );
      if (oauthKeys.length > 5) {
        // Remove oldest entries
        oauthKeys.slice(0, oauthKeys.length - 5).forEach((key) => {
          sessionStorage.removeItem(key);
        });
      }
    }
  };

  // Initiate Google OAuth login
  const loginWithGoogle = useCallback(
    (returnTo?: string): void => {
      try {
        setLoading(true);
        setError(null);

        const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

        if (!googleClientId) {
          throw new Error("Google Client ID not configured");
        }

        const { state } = generateOAuthState();

        // Store returnTo URL in sessionStorage for post-OAuth redirect
        if (returnTo && typeof window !== "undefined") {
          sessionStorage.setItem("oauth_return_to", returnTo);
        }

        // Construct OAuth URL
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const redirectUri = `${baseUrl}/auth/oauth/callback`;

        const params = new URLSearchParams({
          client_id: googleClientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "openid email profile",
          state: state,
          access_type: "offline",
          prompt: "consent",
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

        // Redirect to Google OAuth
        window.location.href = authUrl;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to initiate Google login";
        setError(errorMessage);
        setLoading(false);
      }
    },
    [generateOAuthState]
  );

  // Clear error state
  const clearError = (): void => {
    setError(null);
  };

  // Get stored return URL for post-OAuth redirect
  const getStoredReturnUrl = (): string | null => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("oauth_return_to");
  };

  return {
    loading,
    error,
    loginWithGoogle,
    validateOAuthState,
    clearOAuthState,
    generateOAuthState,
    clearError,
    getStoredReturnUrl,
  };
}

export default useGoogleAuth;
