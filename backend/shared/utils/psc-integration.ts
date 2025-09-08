/**
 * @fileoverview PSC Payout Integration Service
 * @description Service for integrating PSC payouts into interaction endpoints
 * @notes
 * - Handles view counter logic for media views (every 10 views)
 * - Processes immediate payouts for likes, comments, bookmarks, profile views
 * - Integrates with existing PSCPayoutService and DynamoDBService
 * - Includes IP fraud detection to prevent self-payouts
 */

import { DynamoDBService } from "./dynamodb";
import { PSCPayoutService } from "./psc-payout";
import { PayoutEvent } from "@shared/shared-types";
import { checkUsersSharedIPRecently } from "./websocket-ip-analysis";

export class PSCIntegrationService {
  /**
   * Check if users have shared IP recently (potential fraud detection)
   * @param userId - The user performing the action
   * @param creatorId - The creator receiving the payout
   * @param daysBack - How many days back to check (default 30)
   * @returns Promise<boolean> - true if fraud detected (shared IP), false if safe
   */
  private static async checkForIPFraud(
    userId: string,
    creatorId: string,
    daysBack: number = 30
  ): Promise<{
    isFraud: boolean;
    reason?: string;
    sharedIPs?: string[];
  }> {
    try {
      // Skip check if same user (self-interaction is valid in some cases)
      if (userId === creatorId) {
        return {
          isFraud: false,
          reason: "Same user, skipping IP check",
        };
      }

      // Skip check for anonymous users
      if (userId === "anonymous" || !userId || !creatorId) {
        return {
          isFraud: false,
          reason: "Anonymous or missing user, skipping IP check",
        };
      }

      console.log(
        `🔍 Checking for IP fraud between user ${userId} and creator ${creatorId}`
      );

      const ipAnalysis = await checkUsersSharedIPRecently(
        userId,
        creatorId,
        daysBack
      );

      if (ipAnalysis.hasSharedIP && ipAnalysis.sharedIPs.length > 0) {
        console.log(
          `⚠️ IP fraud detected: Users ${userId} and ${creatorId} shared IPs: ${ipAnalysis.sharedIPs.join(
            ", "
          )}`
        );
        return {
          isFraud: true,
          reason: `Users shared IP addresses recently: ${ipAnalysis.sharedIPs.join(
            ", "
          )}`,
          sharedIPs: ipAnalysis.sharedIPs,
        };
      }

      console.log(
        `✅ No IP fraud detected between users ${userId} and ${creatorId}`
      );
      return {
        isFraud: false,
        reason: "No shared IP addresses detected",
      };
    } catch (error) {
      console.error(
        `❌ Error checking IP fraud between ${userId} and ${creatorId}:`,
        error
      );
      // In case of error, allow payout but log the issue
      return {
        isFraud: false,
        reason: "IP fraud check failed, allowing payout",
      };
    }
  }

  /**
   * Process PSC payout for an interaction
   * @param event - The payout event details
   * @param requiresAuth - Whether the interaction requires authentication (false for views)
   * @returns Promise with payout result
   */
  static async processInteractionPayout(
    event: PayoutEvent,
    requiresAuth: boolean = true
  ): Promise<{
    success: boolean;
    amount?: number;
    shouldPayout?: boolean;
    reason?: string;
    viewCount?: number; // For media views, the current view count (0-9)
  }> {
    try {
      // For views on media, we need special handling with the 10-view counter
      if (event.eventType === "view" && event.targetType === "media") {
        return await PSCIntegrationService.processMediaViewPayout(
          event,
          requiresAuth
        );
      }

      // For all other interactions (likes, comments, bookmarks, profile views), process immediately
      return await PSCIntegrationService.processImmediatePayout(event);
    } catch (error) {
      console.error("PSC payout integration error:", error);
      return {
        success: false,
        reason: "Payout processing failed",
      };
    }
  }

  /**
   * Process media view payout with 10-view counter logic
   */
  private static async processMediaViewPayout(
    event: PayoutEvent,
    requiresAuth: boolean
  ): Promise<{
    success: boolean;
    amount?: number;
    shouldPayout?: boolean;
    reason?: string;
    viewCount?: number;
  }> {
    // If authentication is required but no userId provided, skip payout
    if (requiresAuth && !event.userId) {
      return {
        success: true,
        shouldPayout: false,
        reason: "No authenticated user for view tracking",
      };
    }

    // For anonymous views, don't track or payout
    if (!event.userId) {
      return {
        success: true,
        shouldPayout: false,
        reason: "Anonymous view, no payout",
      };
    }

    // Update the user's view counter
    const viewCounter = await DynamoDBService.updateUserViewCounter(
      event.userId,
      true
    );

    // Check if we should payout (when counter resets to 0, meaning we just hit 10 views)
    const shouldPayout =
      viewCounter.mediaViewCount === 0 && viewCounter.totalMediaViews >= 10;

    if (!shouldPayout) {
      return {
        success: true,
        shouldPayout: false,
        viewCount: viewCounter.mediaViewCount,
        reason: `View ${viewCounter.mediaViewCount}/10 tracked, no payout yet`,
      };
    }

    // Before processing payout, check for IP fraud
    const fraudCheck = await PSCIntegrationService.checkForIPFraud(
      event.userId,
      event.creatorId
    );

    if (fraudCheck.isFraud) {
      console.log(
        `🚫 Blocking payout due to IP fraud detection: ${fraudCheck.reason}`
      );
      return {
        success: true,
        shouldPayout: false,
        viewCount: viewCounter.mediaViewCount,
        reason: `Payout blocked: ${fraudCheck.reason}`,
      };
    }

    // Process the payout for the 10th view
    // Create a modified event with metadata indicating this is a 10-view batch payout
    const batchEvent: PayoutEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        batchMultiplier: 10, // Indicate this is a batch payout for 10 views
        batchReason: "10 views accumulated",
      },
    };

    const payoutResult = await PSCPayoutService.processPayout(batchEvent);

    if (payoutResult.success && payoutResult.transaction) {
      return {
        success: true,
        shouldPayout: true,
        amount: payoutResult.transaction.amount, // Amount already includes 10x multiplier
        viewCount: viewCounter.mediaViewCount, // Should be 0 after reset
        reason: "10 views reached, payout processed (10x multiplier applied)",
      };
    } else {
      return {
        success: false,
        shouldPayout: true,
        viewCount: viewCounter.mediaViewCount,
        reason: payoutResult.error || "Payout failed",
      };
    }
  }

  /**
   * Process immediate payout for non-media-view interactions
   */
  private static async processImmediatePayout(event: PayoutEvent): Promise<{
    success: boolean;
    amount?: number;
    shouldPayout?: boolean;
    reason?: string;
  }> {
    // Check for IP fraud before processing payout
    const fraudCheck = await PSCIntegrationService.checkForIPFraud(
      event.userId,
      event.creatorId
    );

    if (fraudCheck.isFraud) {
      console.log(
        `🚫 Blocking immediate payout due to IP fraud detection: ${fraudCheck.reason}`
      );
      return {
        success: true,
        shouldPayout: false,
        reason: `Payout blocked: ${fraudCheck.reason}`,
      };
    }

    const payoutResult = await PSCPayoutService.processPayout(event);

    if (payoutResult.success && payoutResult.transaction) {
      return {
        success: true,
        shouldPayout: true,
        amount: payoutResult.transaction.amount,
        reason: "Payout processed successfully",
      };
    } else {
      return {
        success: false,
        shouldPayout: false,
        reason: payoutResult.error || "Payout not eligible",
      };
    }
  }

  /**
   * Helper to create PayoutEvent from interaction data
   */
  static createPayoutEvent(
    eventType: "view" | "like" | "comment" | "bookmark" | "profile_view",
    targetType: "album" | "media" | "profile",
    targetId: string,
    userId: string | null,
    creatorId: string,
    metadata?: {
      albumId?: string;
      mediaId?: string;
      commentId?: string;
      profileId?: string;
    }
  ): PayoutEvent {
    return {
      eventType,
      targetType,
      targetId,
      userId: userId || "anonymous",
      creatorId,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }
}
