// User Plan and Permission System Types - now imported from shared-types

// Import shared permission types
import type {
  UserPlan,
  UserRole,
  PlanPermissions,
  RolePermissions,
  PermissionContext,
} from "@/types/shared-types";

// Re-export for convenience
export type {
  UserPlan,
  UserRole,
  PlanPermissions,
  RolePermissions,
  PermissionContext,
};

// Additional frontend-specific user types
export interface UserPlanInfo {
  plan: UserPlan;
  isActive: boolean;
  subscriptionId?: string;
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  canceledAt?: string;
  permissions: PlanPermissions;
}

export interface UserWithPlan {
  // Base user properties (without importing User to avoid circular dependency)
  userId: string;
  email: string;
  username?: string;
  createdAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  bio?: string;
  location?: string;
  website?: string;

  // Plan-specific properties
  role: UserRole;
  planInfo: UserPlanInfo;
  // Usage tracking
  usageStats: {
    imagesGeneratedThisMonth: number;
    imagesGeneratedToday: number;
    lastGenerationAt?: string;
  };
}

// Plan definitions - these will be loaded dynamically now
// export const PLAN_DEFINITIONS: Record<UserPlan, PlanPermissions> = permissionsConfig.planPermissions;

// Role-based permissions - these will also be loaded dynamically now
// export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = permissionsConfig.rolePermissions;
