import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PSCPayoutService } from "@shared/utils/psc-payout";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * @fileoverview PSC Admin Overview Handler
 * @description Provides comprehensive overview of PSC system including daily budget, current rates, and system configuration.
 * @auth Requires admin authentication.
 * @returns Overview data with daily budget status, activity metrics, current rates, and system configuration.
 */
const handlePSCOverview = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/psc/overview handler called");
  try {
    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Get current daily budget
    const budget = await DynamoDBService.getBudgetByDate(today!);

    // Get system configuration
    const systemConfig = PSCPayoutService.getSystemConfig();

    // If no budget exists for today, create default budget data
    const currentBudget =
      budget ||
      ({
        totalBudget: systemConfig.dailyBudgetAmount,
        remainingBudget: systemConfig.dailyBudgetAmount,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalBookmarks: 0,
        totalProfileViews: 0,
        currentRates: {
          viewRate: 0,
          likeRate: 0,
          commentRate: 0,
          bookmarkRate: 0,
          profileViewRate: 0,
        },
      } as any);

    // Calculate current rates if budget exists
    let currentRates = currentBudget.currentRates;
    if (budget) {
      try {
        currentRates = await PSCPayoutService.calculateCurrentRates(
          budget,
          systemConfig
        );
      } catch (error) {
        console.warn("Could not calculate current rates:", error);
        // Use default rates from budget
      }
    }

    // Calculate overview data
    const overviewData = {
      dailyBudget: {
        total: currentBudget.totalBudget,
        remaining: currentBudget.remainingBudget,
        distributed: currentBudget.totalBudget - currentBudget.remainingBudget,
        activity: {
          views: currentBudget.totalViews || 0,
          likes: currentBudget.totalLikes || 0,
          comments: currentBudget.totalComments || 0,
          bookmarks: currentBudget.totalBookmarks || 0,
          profileViews: currentBudget.totalProfileViews || 0,
        },
      },
      currentRates: {
        viewRate: currentRates.viewRate || 0,
        likeRate: currentRates.likeRate || 0,
        commentRate: currentRates.commentRate || 0,
        bookmarkRate: currentRates.bookmarkRate || 0,
        profileViewRate: currentRates.profileViewRate || 0,
      },
      systemConfig: {
        dailyBudgetAmount: systemConfig.dailyBudgetAmount,
        enableRewards: systemConfig.enableRewards,
        enableUserToUserTransfers: systemConfig.enableUserToUserTransfers,
        enableWithdrawals: systemConfig.enableWithdrawals,
        minimumPayoutAmount: systemConfig.minimumPayoutAmount,
        maxPayoutPerAction: systemConfig.maxPayoutPerAction,
        rateWeights: systemConfig.rateWeights,
      },
    };

    return ResponseUtil.success(event, overviewData);
  } catch (error) {
    console.error("❌ Error fetching PSC overview:", error);
    return ResponseUtil.internalError(event, "Failed to fetch PSC overview");
  }
};

export const handler = LambdaHandlerUtil.withAdminAuth(handlePSCOverview);
