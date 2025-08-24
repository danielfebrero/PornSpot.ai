/**
 * Centralized permissions configuration loader
 * This utility loads permissions from the backend API
 */

import {
  PlanPermissions,
  RolePermissions,
  UserPlan,
  UserRole,
  FeatureDefinition,
  PermissionsConfig,
} from "@/types";

let permissionsConfigCache: PermissionsConfig | null = null;
let configPromise: Promise<PermissionsConfig> | null = null;

/**
 * Load the full permissions configuration from backend API
 */
export async function loadPermissionsConfig(): Promise<PermissionsConfig> {
  // Return cached version if available
  if (permissionsConfigCache) {
    return permissionsConfigCache;
  }

  // Return existing promise if already loading
  if (configPromise) {
    return configPromise;
  }

  // Create new promise to load config
  configPromise = fetchPermissionsFromAPI();

  try {
    permissionsConfigCache = await configPromise;
    return permissionsConfigCache;
  } catch (error) {
    // Reset promise on error so it can be retried
    configPromise = null;
    throw error;
  }
}

/**
 * Fetch permissions configuration from backend API
 */
async function fetchPermissionsFromAPI(): Promise<PermissionsConfig> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl}/config/permissions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Don't include credentials for config endpoint
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch permissions config: ${response.status}`);
    }

    const result = await response.json();

    // Handle both direct config and API response format
    if (result.success && result.data) {
      return result.data as PermissionsConfig;
    } else if (result.planPermissions) {
      return result as PermissionsConfig;
    } else {
      throw new Error("Invalid permissions configuration format");
    }
  } catch (error) {
    console.error(
      "Failed to fetch permissions from API, using fallback:",
      error
    );

    // Fallback to basic configuration
    return getFallbackPermissions();
  }
}

/**
 * Fallback permissions configuration
 */
function getFallbackPermissions(): PermissionsConfig {
  return {
    planPermissions: {
      anonymous: {
        imagesPerMonth: 30,
        imagesPerDay: 1,
        canUseNegativePrompt: false,
        canUseBulkGeneration: false,
        canUseLoRAModels: false,
        canSelectImageSizes: false,
        canCreatePrivateContent: false,
        canUseCfgScale: false,
        canUseSeed: false,
        canUseSteps: false,
        canBookmark: true,
        canLike: true,
        canComment: true,
        canShare: true,
      },
      free: {
        imagesPerMonth: 30,
        imagesPerDay: 1,
        canUseNegativePrompt: false,
        canUseBulkGeneration: false,
        canUseLoRAModels: false,
        canSelectImageSizes: false,
        canCreatePrivateContent: false,
        canUseCfgScale: false,
        canUseSeed: false,
        canUseSteps: false,
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
        canUseCfgScale: false,
        canUseSeed: false,
        canUseSteps: false,
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
        canUseCfgScale: false,
        canUseSeed: false,
        canUseSteps: false,
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
        canUseCfgScale: true,
        canUseSeed: true,
        canUseSteps: true,
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
        canViewAnalytics: false,
        canModerateContent: false,
        canManageReports: false,
        canManageSubscriptions: false,
        canAccessSystemSettings: false,
        // Backend-specific permissions (set to false for users)
        canDeleteAnyContent: false,
        canBanUsers: false,
        canManageSystem: false,
      },
      moderator: {
        canAccessAdmin: true,
        canManageUsers: false,
        canManageContent: true,
        canViewAnalytics: true,
        canModerateContent: true,
        canManageReports: true,
        canManageSubscriptions: false,
        canAccessSystemSettings: false,
        // Backend-specific permissions (moderate level)
        canDeleteAnyContent: true,
        canBanUsers: false,
        canManageSystem: false,
      },
      admin: {
        canAccessAdmin: true,
        canManageUsers: true,
        canManageContent: true,
        canViewAnalytics: true,
        canModerateContent: true,
        canManageReports: true,
        canManageSubscriptions: true,
        canAccessSystemSettings: true,
        // Backend-specific permissions (full access)
        canDeleteAnyContent: true,
        canBanUsers: true,
        canManageSystem: true,
      },
    },
  };
}

/**
 * Get plan permissions for a specific plan
 */
export async function getPlanPermissions(
  plan: UserPlan
): Promise<PlanPermissions> {
  const config = await loadPermissionsConfig();
  return config.planPermissions[plan];
}

/**
 * Get role permissions for a specific role
 */
export async function getRolePermissions(
  role: UserRole
): Promise<RolePermissions> {
  const config = await loadPermissionsConfig();
  return config.rolePermissions[role];
}

/**
 * Get feature definition by feature key
 */
export async function getFeatureDefinition(
  featureKey: string
): Promise<FeatureDefinition | undefined> {
  const config = await loadPermissionsConfig();
  return config.features?.[featureKey];
}

/**
 * Check if a feature is available for a given plan
 */
export async function isFeatureAvailableForPlan(
  featureKey: string,
  plan: UserPlan
): Promise<boolean> {
  const feature = await getFeatureDefinition(featureKey);
  if (!feature) return false;
  return feature.requiredPlans.includes(plan);
}

/**
 * Get all features available for a specific plan
 */
export async function getFeaturesForPlan(
  plan: UserPlan
): Promise<FeatureDefinition[]> {
  const config = await loadPermissionsConfig();
  if (!config.features) return [];

  return Object.values(config.features).filter((feature) =>
    feature.requiredPlans.includes(plan)
  );
}

/**
 * Get the minimum plan required for a feature
 */
export async function getMinimumPlanForFeature(
  featureKey: string
): Promise<UserPlan | null> {
  const feature = await getFeatureDefinition(featureKey);
  if (!feature || feature.requiredPlans.length === 0) return null;

  const planHierarchy: UserPlan[] = ["free", "starter", "unlimited", "pro"];

  for (const plan of planHierarchy) {
    if (feature.requiredPlans.includes(plan)) {
      return plan;
    }
  }

  return null;
}

/**
 * Get all plan definitions from API
 */
export async function getAllPlanDefinitions(): Promise<
  Record<UserPlan, PlanPermissions>
> {
  const config = await loadPermissionsConfig();
  return config.planPermissions;
}

/**
 * Get all role permissions from API
 */
export async function getAllRolePermissions(): Promise<
  Record<UserRole, RolePermissions>
> {
  const config = await loadPermissionsConfig();
  return config.rolePermissions;
}
