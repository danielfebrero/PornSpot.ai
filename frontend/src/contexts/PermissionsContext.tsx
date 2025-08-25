"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import {
  UserPlan,
  PlanPermissions,
  RolePermissions,
  PermissionContext,
} from "@/types/permissions";
import { User } from "@/types";
import { getPlanPermissions } from "@/utils/permissions";
import {
  useUsageStats,
  useRefreshUsageStats,
} from "@/hooks/queries/useGenerationQuery";

/**
 * TEMPORARY: Until September 30, 2025, all users (including anonymous) get unlimited access to all features
 * This is a promotional period. After this date, normal plan-based permissions will be enforced.
 */
const isTemporaryUnlimitedPeriod = (): boolean => {
  const temporaryEndDate = new Date("2025-09-30T23:59:59.999Z");
  const currentDate = new Date();
  return currentDate < temporaryEndDate;
};

interface PermissionsContextType {
  user: User | null;
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
  canUseCfgScale: () => boolean;
  canUseSeed: () => boolean;
  canUseSteps: () => boolean;

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
  user: User | null;
}

export function PermissionsProvider({
  children,
  user,
}: PermissionsProviderProps) {
  const [planPermissions, setPlanPermissions] =
    useState<PlanPermissions | null>(null);

  // Get real-time usage stats from API
  const { data: usageStats } = useUsageStats();
  const refreshUsageStats = useRefreshUsageStats();

  useEffect(() => {
    const fetchPlanPermissions = async () => {
      const permissions = await getPlanPermissions(
        user?.planInfo?.plan || "anonymous"
      );
      setPlanPermissions(permissions);
    };
    fetchPlanPermissions();
    refreshUsageStats();
  }, [refreshUsageStats, user]);

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
        // Backend-specific permissions
        canDeleteAnyContent: user.role === "admin" || user.role === "moderator",
        canBanUsers: user.role === "admin",
        canManageSystem: user.role === "admin",
      }
    : null;

  // Plan-based permission checks
  const canGenerateImages = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can generate images
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    // Use API usage stats if available, otherwise fallback to user data
    if (usageStats) {
      return usageStats.allowed;
    }

    // Fallback to local data
    if (!user || !planPermissions) return false;
    return !!user.planInfo?.isActive;
  };

  const canGenerateImagesCount = (
    count: number = 1
  ): { allowed: boolean; remaining: number | "unlimited" } => {
    // Use API usage stats if available
    if (usageStats) {
      const remaining = usageStats.remaining || 0;
      const allowed = remaining === "unlimited" || remaining >= count;
      return { allowed, remaining };
    }

    // Fallback to local user data
    if (!user || !planPermissions || !user.planInfo?.isActive) {
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
        monthlyLimit - (user.usageStats?.imagesGeneratedThisMonth || 0);
      if (monthlyRemaining < count) {
        return { allowed: false, remaining: monthlyRemaining };
      }
    }

    // Check daily limit
    if (dailyLimit !== "unlimited") {
      const dailyRemaining =
        dailyLimit - (user.usageStats?.imagesGeneratedToday || 0);
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
          : monthlyLimit - (user.usageStats?.imagesGeneratedThisMonth || 0),
    };
  };

  const canUseBulkGeneration = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use bulk generation
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canUseBulkGeneration && !!user.planInfo?.isActive;
  };

  const canUseLoRAModels = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use LoRA models
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canUseLoRAModels && !!user.planInfo?.isActive;
  };

  const canUseNegativePrompt = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use negative prompts
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canUseNegativePrompt && !!user.planInfo?.isActive;
  };

  const canCreatePrivateContent = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can create private content
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canCreatePrivateContent && !!user.planInfo?.isActive;
  };

  const canUseCustomSizes = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use custom sizes
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canSelectImageSizes && !!user.planInfo?.isActive;
  };

  const canUseCfgScale = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use CFG scale
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canUseCfgScale && !!user.planInfo?.isActive;
  };

  const canUseSeed = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use seed
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canUseSeed && !!user.planInfo?.isActive;
  };

  const canUseSteps = (): boolean => {
    // TEMPORARY: Until September 30, 2025, everyone can use steps
    if (isTemporaryUnlimitedPeriod()) {
      return true;
    }

    if (!user || !planPermissions) return false;
    return planPermissions.canUseSteps && !!user.planInfo?.isActive;
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
    return user?.planInfo?.plan || ("free" as UserPlan);
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
          (user.usageStats?.imagesGeneratedThisMonth || 0) <
          planPermissions.imagesPerMonth
        );

      case "imagesPerDay":
        if (planPermissions.imagesPerDay === "unlimited") return true;
        return (
          (user.usageStats?.imagesGeneratedToday || 0) <
          planPermissions.imagesPerDay
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
    canUseCfgScale,
    canUseSeed,
    canUseSteps,
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
