/*
 * File objective: Return usage stats using SimplifiedRateLimitingService for quota management.
 * Auth: Uses withOptionalAuth to support both authenticated users and anonymous users.
 *
 * Key responsibilities:
 * - Uses SimplifiedRateLimitingService.checkRateLimit to get quota info
 * - Returns the rate limit result for PermissionsContext to use
 * - Simple passthrough of quota information
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import {
  LambdaHandlerUtil,
  OptionalAuthResult,
} from "@shared/utils/lambda-handler";
import { SimplifiedRateLimitingService } from "@shared/services/simple-rate-limiting";
import { PlanUtil } from "@shared/utils/plan";
import { User, UserPlan } from "@shared";

export interface UsageStatsResponse {
  allowed: boolean;
  reason?: string;
  remaining?: number | "unlimited";
  userId: string | null;
  plan?: UserPlan;
}

/**
 * Get usage statistics using the simplified rate limiting service
 */
async function handleUsageStats(
  event: APIGatewayProxyEvent,
  auth: OptionalAuthResult
): Promise<APIGatewayProxyResult> {
  try {
    // Validate HTTP method
    if (event.httpMethod !== "GET") {
      return ResponseUtil.badRequest(event, "Only GET method allowed");
    }

    const simplifiedRateLimitingService =
      SimplifiedRateLimitingService.getInstance();

    let user: User | undefined;

    // Get user info if authenticated
    if (auth.userId) {
      const userEntity = await DynamoDBService.getUserById(auth.userId);
      if (userEntity) {
        user = await PlanUtil.enhanceUser(userEntity);
      }
    }

    // Check rate limit to get usage info
    const rateLimitResult = await simplifiedRateLimitingService.checkRateLimit(
      event,
      user
    );

    const response: UsageStatsResponse = {
      allowed: rateLimitResult.allowed,
      reason: rateLimitResult.reason,
      remaining: rateLimitResult.remaining,
      userId: auth.userId || null,
      plan: user?.planInfo.plan,
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to get usage stats"
    );
  }
}

export const handler = LambdaHandlerUtil.withOptionalAuth(handleUsageStats);
