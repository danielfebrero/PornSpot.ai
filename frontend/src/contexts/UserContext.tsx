"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { UserContextType, UserWithPlanInfo } from "@/types";
import { userApi } from "@/lib/api";

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithPlanInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);

      const response = await userApi.me();
      if (!response) {
        setUser(null);
      }

      setUser(response.user);
    } catch (err) {
      // Silent fail for auth check - user is simply not authenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearUser = useCallback((): void => {
    setUser(null);
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setInitializing(false);
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Simplified context value - authentication logic moved to TanStack Query hooks
  const contextValue: UserContextType = {
    user,
    loading: loading || initializing,
    error: null, // Error handling moved to individual mutations
    initializing,
    isEmailVerified: user?.isEmailVerified || false,
    emailVerificationRequired: false, // This is now handled by mutations
    // These functions are now handled by TanStack Query mutations
    // but kept for backward compatibility with types
    login: async () => {
      throw new Error("Use useLogin hook instead");
    },
    register: async () => {
      throw new Error("Use useRegister hook instead");
    },
    logout: async () => {
      throw new Error("Use useLogout hook instead");
    },
    checkAuth, // Keep this for initialization
    verifyEmail: async () => {
      throw new Error("Use useVerifyEmail hook instead");
    },
    resendVerification: async () => {
      throw new Error("Use useResendVerification hook instead");
    },
    clearError: () => {}, // No-op since error handling moved to mutations
    clearUser, // Add clearUser method
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUserContext(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
