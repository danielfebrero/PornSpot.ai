/**
 * @fileoverview User PSC Statistics API
 * @description API endpoints for users to view their PSC performance and rate statistics
 * @notes
 * - Returns user's PSC earnings stats
 * - Includes historical rate data from snapshots
 * - Daily and weekly rate trends
 * - Performance insights and analytics
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { PSCRateSnapshotService } from "@shared/services/pscRateSnapshotService";
import { DynamoDBService } from "@shared/utils/dynamodb";
import {
  PSCRateSnapshotsResponse,
  RateSnapshotEntity,
} from "@shared/shared-types";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handlePSCStats = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("📊 /user/psc/stats handler called");

  try {
    const period = event.queryStringParameters?.["period"] || "weekly";
    const userId = auth.userId;

    if (period === "snapshots") {
      // Return rate snapshots for charting
      return await getRateSnapshots(event);
    }

    // Get user's transaction history to calculate stats
    const transactionResult = await DynamoDBService.getTransactionsByUser(
      userId,
      200 // Get more transactions for better statistics
    );

    const transactions = transactionResult.items;
    const rewardTransactions = transactions.filter(
      (t) => t.transactionType.startsWith("reward_") && t.status === "completed"
    );

    const totalInteractions = rewardTransactions.length;

    // For weekly period, return only the simplified metrics needed by frontend
    if (period === "weekly") {
      // Calculate total views for the week
      const viewTransactions = rewardTransactions.filter(
        (t) => t.transactionType === "reward_view"
      );
      const totalViews = viewTransactions.length;

      // Calculate payout growth (current week vs previous week)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Current week transactions
      const currentWeekTransactions = rewardTransactions.filter((t) => {
        const txDate = new Date(t.createdAt);
        return txDate >= oneWeekAgo;
      });

      // Previous week transactions
      const previousWeekTransactions = rewardTransactions.filter((t) => {
        const txDate = new Date(t.createdAt);
        return txDate >= twoWeeksAgo && txDate < oneWeekAgo;
      });

      const currentWeekEarnings = currentWeekTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      );
      const previousWeekEarnings = previousWeekTransactions.reduce(
        (sum, t) => sum + t.amount,
        0
      );

      const payoutGrowth =
        previousWeekEarnings > 0
          ? ((currentWeekEarnings - previousWeekEarnings) /
              previousWeekEarnings) *
            100
          : currentWeekEarnings > 0
          ? 100
          : 0;

      const simplifiedStats = {
        totalInteractions,
        totalViews,
        payoutGrowth: Math.round(payoutGrowth * 10) / 10, // Round to 1 decimal place
      };

      return ResponseUtil.success(event, {
        stats: simplifiedStats,
      });
    }

    // For non-weekly periods, return basic stats (currently not used by frontend)
    const stats = {
      totalInteractions,
      totalViews: 0, // Not calculated for non-weekly periods
      payoutGrowth: 0, // Not calculated for non-weekly periods
    };

    return ResponseUtil.success(event, {
      stats,
    });
  } catch (error) {
    console.error("Error fetching PSC statistics:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to fetch PSC statistics"
    );
  }
};

/**
 * Get rate snapshots for chart data
 */
async function getRateSnapshots(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const interval = event.queryStringParameters?.["interval"] || "weekly";

    let snapshots: RateSnapshotEntity[];
    if (interval === "daily") {
      snapshots = await PSCRateSnapshotService.getDailySnapshots();
    } else {
      snapshots = await PSCRateSnapshotService.getWeeklySnapshots();
    }

    const response: PSCRateSnapshotsResponse = {
      snapshots,
      dailySnapshots: interval === "daily" ? snapshots : undefined,
      weeklySnapshots: interval === "weekly" ? snapshots : undefined,
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("Error fetching rate snapshots:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to fetch rate snapshots"
    );
  }
}

export const handler = LambdaHandlerUtil.withAuth(handlePSCStats, {
  requireBody: false,
});
