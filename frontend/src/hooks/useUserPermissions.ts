"use client";

import { usePermissions } from "@/contexts/PermissionsContext";
import { UserPlan } from "@/types/permissions";

export function useUserPermissions() {
  const permissions = usePermissions();

  // Convenience methods for common permission checks
  const checkGenerationLimits = (count = 1) => {
    return permissions.canGenerateImagesCount(count);
  };

  const canUpgradeToUnlimited = () => {
    const plan = permissions.getCurrentPlan();
    return plan === "anonymous" || "free" || plan === "starter";
  };

  const canUpgradeToPro = () => {
    const plan = permissions.getCurrentPlan();
    return plan !== "pro";
  };

  const getUpgradeRecommendation = (
    requestedFeature: string
  ): UserPlan | null => {
    const planLimits = permissions.getPlanLimits();

    if (!planLimits) return null;

    // Use actual permissions from the configuration
    // Based on actual pricing page features
    switch (requestedFeature) {
      case "unlimited-images":
        // Check if current plan has limited images
        if (typeof planLimits.imagesPerMonth === "number") {
          return "unlimited"; // First plan with unlimited images
        }
        return null;

      case "negative-prompts":
        // Check if current plan can use negative prompts
        if (!planLimits.canUseNegativePrompt) {
          return "pro"; // Only Pro plan supports negative prompts
        }
        return null;

      case "bulk-generation":
        // Check if current plan supports bulk generation
        if (!planLimits.canUseBulkGeneration) {
          return "pro"; // Only Pro plan supports bulk generation
        }
        return null;

      case "lora-models":
        // Check if current plan supports LoRA models
        if (!planLimits.canUseLoRAModels) {
          return "pro"; // Only Pro plan supports LoRA models
        }
        return null;

      case "private-content":
        // Check if current plan supports private content
        if (!planLimits.canCreatePrivateContent) {
          return "pro"; // Only Pro plan supports private content
        }
        return null;

      case "custom-image-sizes":
        // Check if current plan supports custom image sizes
        if (!planLimits.canSelectImageSizes) {
          // Return the first plan that supports it (Pro only based on pricing)
          return "pro";
        }
        return null;

      default:
        return null;
    }
  };

  const getPlanFeatures = (plan: UserPlan) => {
    const features = [];

    switch (plan) {
      case "free":
        features.push("1 image per day", "5 bonus images on signup");
        break;

      case "starter":
        features.push("300 images/month");
        break;

      case "unlimited":
        features.push("Unlimited images");
        break;

      case "pro":
        features.push(
          "Unlimited images",
          "Private content",
          "LoRA models",
          "Negative prompts",
          "Bulk generation",
          "Custom image size"
        );
        break;
    }

    return features;
  };

  const formatUsageText = (
    used: number,
    limit: number | "unlimited",
    unit: string
  ) => {
    if (limit === "unlimited") {
      return `${used} ${unit} used`;
    }
    return `${used} / ${limit} ${unit} used`;
  };

  const getUsagePercentage = (used: number, limit: number | "unlimited") => {
    if (limit === "unlimited") return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const isApproachingLimit = (
    used: number,
    limit: number | "unlimited",
    threshold = 0.8
  ) => {
    if (limit === "unlimited") return false;
    return used / limit >= threshold;
  };

  return {
    ...permissions,
    checkGenerationLimits,
    canUpgradeToUnlimited,
    canUpgradeToPro,
    getUpgradeRecommendation,
    getPlanFeatures,
    formatUsageText,
    getUsagePercentage,
    isApproachingLimit,
  };
}
