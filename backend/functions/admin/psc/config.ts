import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { PSCPayoutService } from "@shared/utils/psc-payout";
import { PSCSystemConfig } from "@shared/shared-types";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * @fileoverview PSC Admin Configuration Handler
 * @description Manages PSC system configuration - get, update, and reset operations.
 * @auth Requires admin authentication.
 * @methods GET (get config), PUT (update config), POST (reset config)
 */
const handlePSCConfig = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(`🔍 /admin/psc/config ${event.httpMethod} handler called`);
  try {
    const method = event.httpMethod;

    switch (method) {
      case "GET":
        return await handleGetConfig(event);
      case "PUT":
        return await handleUpdateConfig(event);
      case "POST":
        // Check if this is a reset request
        if (
          event.pathParameters &&
          event.pathParameters["action"] === "reset"
        ) {
          return await handleResetConfig(event);
        }
        return ResponseUtil.error(event, "Invalid POST action");
      default:
        return ResponseUtil.error(event, `Method ${method} not allowed`);
    }
  } catch (error) {
    console.error("PSC config error:", error);
    return ResponseUtil.error(
      event,
      "Failed to process PSC configuration request"
    );
  }
};

/**
 * Get current PSC system configuration
 */
async function handleGetConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Try to get config from database first
    const { DynamoDBService } = await import("@shared/utils/dynamodb");
    const savedConfig = await DynamoDBService.getPSCConfig();

    if (savedConfig) {
      return ResponseUtil.success(event, savedConfig);
    }

    // If no saved config, return default config
    const config = PSCPayoutService.getSystemConfig();
    return ResponseUtil.success(event, config);
  } catch (error) {
    console.error("Error getting PSC config:", error);
    // Fallback to default config
    const config = PSCPayoutService.getSystemConfig();
    return ResponseUtil.success(event, config);
  }
}

/**
 * Update PSC system configuration
 */
async function handleUpdateConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return ResponseUtil.error(event, "Request body is required");
  }

  try {
    const configUpdate = JSON.parse(event.body) as Partial<PSCSystemConfig>;

    // Validate the configuration
    const validationError = validateConfig(configUpdate);
    if (validationError) {
      return ResponseUtil.error(event, validationError);
    }

    // Get current config (from database or default)
    const { DynamoDBService } = await import("@shared/utils/dynamodb");
    let currentConfig = await DynamoDBService.getPSCConfig();

    if (!currentConfig) {
      currentConfig = await PSCPayoutService.getSystemConfig();
    }

    // Merge with updates
    const updatedConfig: PSCSystemConfig = {
      ...currentConfig,
      ...configUpdate,
      // Ensure rate weights are properly merged
      rateWeights: {
        ...currentConfig.rateWeights,
        ...(configUpdate.rateWeights || {}),
      },
    };

    // Save to DynamoDB
    await DynamoDBService.savePSCConfig(updatedConfig);

    console.log("Updated and saved PSC config:", updatedConfig);

    return ResponseUtil.success(event, updatedConfig);
  } catch (error) {
    console.error("Config update error:", error);
    return ResponseUtil.error(event, "Invalid configuration data");
  }
}

/**
 * Reset PSC configuration to defaults
 */
async function handleResetConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // TODO: In the future, clear any stored config from DynamoDB
  const defaultConfig = PSCPayoutService.getSystemConfig();

  console.log("Reset PSC config to defaults");

  return ResponseUtil.success(event, defaultConfig);
}

/**
 * Validate PSC configuration
 */
function validateConfig(config: Partial<PSCSystemConfig>): string | null {
  // Validate daily budget amount
  if (config.dailyBudgetAmount !== undefined) {
    if (
      typeof config.dailyBudgetAmount !== "number" ||
      config.dailyBudgetAmount < 0
    ) {
      return "Daily budget amount must be a non-negative number";
    }
    if (config.dailyBudgetAmount > 10000) {
      return "Daily budget amount cannot exceed 10,000 PSC";
    }
  }

  // Validate minimum payout amount
  if (config.minimumPayoutAmount !== undefined) {
    if (
      typeof config.minimumPayoutAmount !== "number" ||
      config.minimumPayoutAmount < 0
    ) {
      return "Minimum payout amount must be a non-negative number";
    }
  }

  // Validate max payout per action
  if (config.maxPayoutPerAction !== undefined) {
    if (
      typeof config.maxPayoutPerAction !== "number" ||
      config.maxPayoutPerAction < 0
    ) {
      return "Max payout per action must be a non-negative number";
    }
    if (config.maxPayoutPerAction > 100000) {
      return "Max payout per action cannot exceed 100,000 PSC";
    }
  }

  // Validate rate weights
  if (config.rateWeights) {
    const weights = config.rateWeights;
    const weightKeys = [
      "view",
      "like",
      "comment",
      "bookmark",
      "profileView",
    ] as const;

    for (const key of weightKeys) {
      if (weights[key] !== undefined) {
        if (typeof weights[key] !== "number" || weights[key] < 0) {
          return `Rate weight for ${key} must be a non-negative number`;
        }
        if (weights[key] > 1000) {
          return `Rate weight for ${key} cannot exceed 1000`;
        }
      }
    }
  }

  // Validate boolean flags
  const booleanFields = [
    "enableRewards",
    "enableUserToUserTransfers",
    "enableWithdrawals",
  ] as const;
  for (const field of booleanFields) {
    if (config[field] !== undefined && typeof config[field] !== "boolean") {
      return `${field} must be a boolean value`;
    }
  }

  return null; // No validation errors
}

export const handler = LambdaHandlerUtil.withAdminAuth(handlePSCConfig);
