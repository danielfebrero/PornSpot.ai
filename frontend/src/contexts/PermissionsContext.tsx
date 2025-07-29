"use client";

import React, { createContext, useContext, ReactNode } from "react";
import {
  UserWithPlan,
  UserPlan,
  PlanPermissions,
  RolePermissions,
  PermissionContext,
} from "@/types/permissions";

interface PermissionsContextType {
  user: UserWithPlan | null;
  planPermissions: PlanPermissions | null;
  rolePermissions: RolePermissions | null;

  // Plan-based permission checks
  canGenerateImages: () => boolean;
  canGenerateImagesCount: (count?: number) => {
    allowed: boolean;
    remaining: number | "unlimited";
  };
  canUseBulkGeneration: () => boolean;
  canUseLoRAModels: () => boolean;
  canUseNegativePrompt: () => boolean;
  canCreatePrivateContent: () => boolean;
  canUseCustomSizes: () => boolean;

  // Role-based permission checks
  canAccessAdmin: () => boolean;
  canManageUsers: () => boolean;
  canModerateContent: () => boolean;

  // Generic permission checker
  hasPermission: (context: PermissionContext) => boolean;

  // Plan information
  getCurrentPlan: () => UserPlan;
  getPlanLimits: () => PlanPermissions | null;
  isWithinLimits: (feature: keyof PlanPermissions) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);

interface PermissionsProviderProps {
  children: ReactNode;
  user: UserWithPlan | null;
}

export function PermissionsProvider({
  children,
  user,
}: PermissionsProviderProps) {
  const planPermissions = user?.planInfo?.permissions || null;

  // Basic role permissions - in the future this should be loaded from API
  const rolePermissions: RolePermissions | null = user
    ? {
        canAccessAdmin: user.role === "admin",
        canManageUsers: user.role === "admin",
        canManageContent: user.role === "admin" || user.role === "moderator",
        canViewAnalytics: user.role === "admin" || user.role === "moderator",
        canModerateContent: user.role === "admin" || user.role === "moderator",
        canManageReports: user.role === "admin" || user.role === "moderator",
        canManageSubscriptions: user.role === "admin",
        canAccessSystemSettings: user.role === "admin",
      }
    : null;

  // Plan-based permission checks
  const canGenerateImages = (): boolean => {
    if (!user || !planPermissions) return false;
    return planPermissions.canGenerateImages && user.planInfo.isActive;
  };

  const canGenerateImagesCount = (
    count: number = 1
  ): { allowed: boolean; remaining: number | "unlimited" } => {
    console.log({ user, planPermissions });
    if (!user || !planPermissions || !user.planInfo.isActive) {
      return { allowed: false, remaining: 0 };
    }

    const monthlyLimit = planPermissions.imagesPerMonth;
    const dailyLimit = planPermissions.imagesPerDay;

    if (monthlyLimit === "unlimited" && dailyLimit === "unlimited") {
      return { allowed: true, remaining: "unlimited" };
    }

    // Check monthly limit
    if (monthlyLimit !== "unlimited") {
      const monthlyRemaining =
        monthlyLimit - user.usageStats.imagesGeneratedThisMonth;
      if (monthlyRemaining < count) {
        return { allowed: false, remaining: monthlyRemaining };
      }
    }

    // Check daily limit
    if (dailyLimit !== "unlimited") {
      const dailyRemaining = dailyLimit - user.usageStats.imagesGeneratedToday;
      if (dailyRemaining < count) {
        return { allowed: false, remaining: dailyRemaining };
      }
      return { allowed: true, remaining: dailyRemaining };
    }

    return {
      allowed: true,
      remaining:
        monthlyLimit === "unlimited"
          ? "unlimited"
          : monthlyLimit - user.usageStats.imagesGeneratedThisMonth,
    };
  };

  const canUseBulkGeneration = (): boolean => {
    if (!user || !planPermissions) return false;
    return planPermissions.canUseBulkGeneration && user.planInfo.isActive;
  };

  const canUseLoRAModels = (): boolean => {
    if (!user || !planPermissions) return false;
    return planPermissions.canUseLoRAModels && user.planInfo.isActive;
  };

  const canUseNegativePrompt = (): boolean => {
    if (!user || !planPermissions) return false;
    return planPermissions.canUseNegativePrompt && user.planInfo.isActive;
  };

  const canCreatePrivateContent = (): boolean => {
    if (!user || !planPermissions) return false;
    return planPermissions.canCreatePrivateContent && user.planInfo.isActive;
  };

  const canUseCustomSizes = (): boolean => {
    if (!user || !planPermissions) return false;
    return planPermissions.canSelectImageSizes && user.planInfo.isActive;
  };

  // Role-based permission checks
  const canAccessAdmin = (): boolean => {
    if (!user || !rolePermissions) return false;
    return rolePermissions.canAccessAdmin;
  };

  const canManageUsers = (): boolean => {
    if (!user || !rolePermissions) return false;
    return rolePermissions.canManageUsers;
  };

  const canModerateContent = (): boolean => {
    if (!user || !rolePermissions) return false;
    return rolePermissions.canModerateContent;
  };

  // Generic permission checker
  const hasPermission = (context: PermissionContext): boolean => {
    if (!user || !planPermissions || !rolePermissions) return false;

    switch (context.feature) {
      case "generation":
        switch (context.action) {
          case "create":
            return canGenerateImages();
          case "bulk":
            return canUseBulkGeneration();
          case "lora":
            return canUseLoRAModels();
          case "negative-prompt":
            return canUseNegativePrompt();
          case "private":
            return canCreatePrivateContent();
          default:
            return false;
        }
      case "admin":
        switch (context.action) {
          case "access":
            return canAccessAdmin();
          case "manage-users":
            return canManageUsers();
          case "moderate":
            return canModerateContent();
          default:
            return false;
        }
      case "content":
        switch (context.action) {
          case "bookmark":
            return planPermissions.canBookmark;
          case "like":
            return planPermissions.canLike;
          case "comment":
            return planPermissions.canComment;
          case "share":
            return planPermissions.canShare;
          default:
            return false;
        }
      default:
        return false;
    }
  };

  // Plan information
  const getCurrentPlan = (): UserPlan => {
    return user?.planInfo.plan || "free";
  };

  const getPlanLimits = (): PlanPermissions | null => {
    return planPermissions;
  };

  const isWithinLimits = (feature: keyof PlanPermissions): boolean => {
    if (!user || !planPermissions) return false;

    switch (feature) {
      case "imagesPerMonth":
        if (planPermissions.imagesPerMonth === "unlimited") return true;
        return (
          user.usageStats.imagesGeneratedThisMonth <
          planPermissions.imagesPerMonth
        );

      case "imagesPerDay":
        if (planPermissions.imagesPerDay === "unlimited") return true;
        return (
          user.usageStats.imagesGeneratedToday < planPermissions.imagesPerDay
        );

      default:
        return true;
    }
  };

  const value: PermissionsContextType = {
    user,
    planPermissions,
    rolePermissions,
    canGenerateImages,
    canGenerateImagesCount,
    canUseBulkGeneration,
    canUseLoRAModels,
    canUseNegativePrompt,
    canCreatePrivateContent,
    canUseCustomSizes,
    canAccessAdmin,
    canManageUsers,
    canModerateContent,
    hasPermission,
    getCurrentPlan,
    getPlanLimits,
    isWithinLimits,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = (): PermissionsContextType => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
};
