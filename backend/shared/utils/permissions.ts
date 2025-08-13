/**
 * Shared permissions configuration for backend Lambda functions
 * This file loads permissions from the shared layer
 */

const fs = require("fs");
const path = require("path");

// Import shared permission types instead of defining them locally
import type {
  UserPlan,
  UserRole,
  PlanPermissions,
  RolePermissions,
  GenerationPermissions,
} from "@shared/shared-types";

// Re-export for backward compatibility
export type {
  UserPlan,
  UserRole,
  PlanPermissions,
  RolePermissions,
  GenerationPermissions,
};

export interface PermissionsConfig {
  planPermissions: Record<UserPlan, PlanPermissions>;
  rolePermissions: Record<UserRole, RolePermissions>;
}

let permissionsConfig: PermissionsConfig | null = null;

/**
 * Load permissions configuration from JSON file
 */
function loadPermissionsConfig(): PermissionsConfig {
  if (permissionsConfig) {
    return permissionsConfig!;
  }

  try {
    // Try to load from shared directory (for backend functions)
    const sharedPath = path.join(__dirname, "permissions.json");
    console.log("Loading permissions config from:", sharedPath);
    if (fs.existsSync(sharedPath)) {
      const configData = fs.readFileSync(sharedPath, "utf8");
      permissionsConfig = JSON.parse(configData);
      return permissionsConfig!;
    }

    throw new Error("Permissions configuration file not found");
  } catch (error) {
    console.error("Failed to load permissions config:", error);
    // Return default configuration as fallback
    return {
      planPermissions: {
        free: {
          imagesPerMonth: 30,
          imagesPerDay: 1,
          canUseNegativePrompt: false,
          canUseBulkGeneration: false,
          canUseLoRAModels: false,
          canSelectImageSizes: false,
          canCreatePrivateContent: false,
          canBookmark: true,
          canLike: true,
          canComment: true,
          canShare: true,
        },
        starter: {
          imagesPerMonth: 300,
          imagesPerDay: 20,
          canUseNegativePrompt: false,
          canUseBulkGeneration: false,
          canUseLoRAModels: false,
          canSelectImageSizes: false,
          canCreatePrivateContent: false,
          canBookmark: true,
          canLike: true,
          canComment: true,
          canShare: true,
        },
        unlimited: {
          imagesPerMonth: "unlimited",
          imagesPerDay: "unlimited",
          canUseNegativePrompt: false,
          canUseBulkGeneration: false,
          canUseLoRAModels: false,
          canSelectImageSizes: false,
          canCreatePrivateContent: false,
          canBookmark: true,
          canLike: true,
          canComment: true,
          canShare: true,
        },
        pro: {
          imagesPerMonth: "unlimited",
          imagesPerDay: "unlimited",
          canUseNegativePrompt: true,
          canUseBulkGeneration: true,
          canUseLoRAModels: true,
          canSelectImageSizes: true,
          canCreatePrivateContent: true,
          canBookmark: true,
          canLike: true,
          canComment: true,
          canShare: true,
        },
      },
      rolePermissions: {
        user: {
          canAccessAdmin: false,
          canManageUsers: false,
          canManageContent: false,
          canDeleteAnyContent: false,
          canBanUsers: false,
          canViewAnalytics: false,
          canManageSystem: false,
          canModerateContent: false,
          canManageReports: false,
          canManageSubscriptions: false,
          canAccessSystemSettings: false,
        },
        moderator: {
          canAccessAdmin: true,
          canManageUsers: false,
          canManageContent: true,
          canDeleteAnyContent: true,
          canBanUsers: false,
          canViewAnalytics: true,
          canManageSystem: false,
          canModerateContent: true,
          canManageReports: true,
          canManageSubscriptions: false,
          canAccessSystemSettings: false,
        },
        admin: {
          canAccessAdmin: true,
          canManageUsers: true,
          canManageContent: true,
          canDeleteAnyContent: true,
          canBanUsers: true,
          canViewAnalytics: true,
          canManageSystem: true,
          canModerateContent: true,
          canManageReports: true,
          canManageSubscriptions: true,
          canAccessSystemSettings: true,
        },
      },
    };
  }
}

/**
 * Load plan permissions from shared configuration
 */
export function getPlanPermissions(plan: UserPlan): PlanPermissions {
  const config = loadPermissionsConfig();
  return config.planPermissions[plan];
}

/**
 * Load role permissions from shared configuration
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  const config = loadPermissionsConfig();
  return config.rolePermissions[role];
}

/**
 * Get generation-specific permissions for a plan (for backward compatibility)
 */
export function getGenerationPermissions(
  plan: UserPlan
): GenerationPermissions {
  const planPerms = getPlanPermissions(plan);

  return {
    canUseBulkGeneration: planPerms.canUseBulkGeneration,
    canUseLoRAModels: planPerms.canUseLoRAModels,
    canSelectImageSizes: planPerms.canSelectImageSizes,
    canUseNegativePrompt: planPerms.canUseNegativePrompt,
  };
}

/**
 * Get all permissions configuration
 */
export function getPermissionsConfig(): PermissionsConfig {
  return loadPermissionsConfig();
}
