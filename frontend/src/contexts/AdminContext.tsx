"use client";

import React, { createContext, useContext } from "react";
import {
  useLogin,
  useLogout,
  useCheckAuth,
} from "@/hooks/queries/useUserQuery";
import { User } from "@/types";
import { useUserContext } from "./UserContext";

interface AdminContextType {
  user: User | null;
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
  const { user, loading: isLoading } = useUserContext();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const checkAuthMutation = useCheckAuth();

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
