// Shared permission and plan types

export type UserPlan = "anonymous" | "free" | "starter" | "unlimited" | "pro";

export type UserRole = "user" | "admin" | "moderator";

// Specific permissions for different features
export interface PlanPermissions extends GenerationPermissions {
  // Image generation limits
  imagesPerMonth: number | "unlimited";
  imagesPerDay: number | "unlimited";

  // Content management
  canCreatePrivateContent: boolean;

  // Community features
  canBookmark: boolean;
  canLike: boolean;
  canComment: boolean;
  canShare: boolean;
}

// Unified role-based permissions (for admin functions)
export interface RolePermissions {
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageContent: boolean;
  canViewAnalytics: boolean;
  canModerateContent: boolean;
  canManageReports: boolean;
  // Backend-specific permissions
  canDeleteAnyContent: boolean;
  canBanUsers: boolean;
  canManageSystem: boolean;
  // Frontend-specific permissions
  canManageSubscriptions: boolean;
  canAccessSystemSettings: boolean;
}

// Permission check helper types
export interface PermissionContext {
  feature: string;
  action: string;
  resource?: string;
}

// Generation-specific permissions (backend-specific)
export interface GenerationPermissions {
  canUseNegativePrompt: boolean;
  canUseBulkGeneration: boolean;
  canUseLoRAModels: boolean;
  canSelectImageSizes: boolean;
  canCreatePrivateContent: boolean;
  canUseCfgScale: boolean;
  canUseSeed: boolean;
  canUseSteps: boolean;
}

// Configuration types for permissions system
export interface FeatureDefinition {
  name: string;
  description: string;
  requiredPlans: UserPlan[];
  category: string;
  icon: string;
}

export interface PermissionsConfig {
  planPermissions: Record<UserPlan, PlanPermissions>;
  rolePermissions: Record<UserRole, RolePermissions>;
  features?: Record<string, FeatureDefinition>;
}
