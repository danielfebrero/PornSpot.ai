"use client";

import React, { createContext, useContext } from "react";
import {
  useUserProfile,
  useLogin,
  useLogout,
  useCheckAuth,
} from "@/hooks/queries/useUserQuery";
import { UserWithPlanInfo } from "../types/user";

interface AdminContextType {
  user: UserWithPlanInfo | null;
  loading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  isAdmin: boolean;
  isModerator: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { data: userProfile, isLoading } = useUserProfile();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const checkAuthMutation = useCheckAuth();

  const user = userProfile?.user as UserWithPlanInfo | null;
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const hasAdminAccess = isAdmin || isModerator;

  // Admin-specific context that wraps the user context
  const adminContextValue: AdminContextType = {
    user: hasAdminAccess ? user : null,
    loading:
      isLoading ||
      loginMutation.isPending ||
      logoutMutation.isPending ||
      checkAuthMutation.isPending,
    error:
      loginMutation.error?.message ||
      logoutMutation.error?.message ||
      checkAuthMutation.error?.message ||
      null,
    login: async (credentials: { email: string; password: string }) => {
      const result = await loginMutation.mutateAsync(credentials);
      return !!result;
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    checkAuth: async () => {
      await checkAuthMutation.mutateAsync();
    },
    isAdmin,
    isModerator,
  };

  return (
    <AdminContext.Provider value={adminContextValue}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext(): AdminContextType {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdminContext must be used within an AdminProvider");
  }
  return context;
}
