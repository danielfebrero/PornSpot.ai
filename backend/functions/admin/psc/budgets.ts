import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PSCPayoutService } from "@shared/utils/psc-payout";
import { DailyBudgetEntity } from "@shared/shared-types";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * @fileoverview PSC Admin Budget Management Handler
 * @description Manages daily budgets for PSC system - list budgets and update budget amounts.
 * @auth Requires admin authentication.
 * @methods GET (list budgets), PUT (update specific budget)
 */
const handlePSCBudgets = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(`🔍 /admin/psc/budgets ${event.httpMethod} handler called`);

  try {
    const method = event.httpMethod;

    switch (method) {
      case "GET":
        return await handleGetBudgets(event);
      case "PUT":
        return await handleUpdateBudget(event);
      default:
        return ResponseUtil.error(event, `Method ${method} not allowed`, 405);
    }
  } catch (error) {
    console.error("❌ PSC budgets handler error:", error);
    return ResponseUtil.internalError(event, "Internal server error");
  }
};

/**
 * Get daily budgets with optional filtering
 */
async function handleGetBudgets(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const startDate = params["startDate"];
    const endDate = params["endDate"];
    const limit = parseInt(params["limit"] || "30", 10);

    // Validate limit
    if (limit > 100) {
      return ResponseUtil.error(event, "Limit cannot exceed 100", 400);
    }

    // Generate date range (defaults to last 30 days)
    const dates: string[] = [];
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - (limit - 1) * 24 * 60 * 60 * 1000);

    // Generate array of dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split("T")[0];
      if (dateString) {
        dates.push(dateString);
      }
    }

    // Limit dates array
    const limitedDates = dates.slice(-limit);

    console.log(`📅 Fetching budgets for ${limitedDates.length} dates`);

    // Fetch budgets for each date
    const budgets: DailyBudgetEntity[] = [];

    for (const dateString of limitedDates) {
      // Try to get budget from database
      const budget = await DynamoDBService.getBudgetByDate(dateString);

      if (budget) {
        budgets.push(budget);
      } else {
        // Create mock budget data for dates without records
        const systemConfig = PSCPayoutService.getSystemConfig();
        const mockBudget: DailyBudgetEntity = {
          PK: `PSC_BUDGET#${dateString}`,
          SK: "METADATA",
          GSI1PK: "PSC_BUDGET",
          GSI1SK: dateString,
          EntityType: "DailyBudget",
          date: dateString,
          totalBudget: systemConfig.dailyBudgetAmount,
          remainingBudget: systemConfig.dailyBudgetAmount,
          distributedBudget: 0,
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
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        budgets.push(mockBudget);
      }
    }

    // Transform to frontend format
    const transformedBudgets = budgets.map((budget) => ({
      date: budget.date,
      totalBudget: budget.totalBudget,
      remainingBudget: budget.remainingBudget,
      distributedAmount: budget.totalBudget - budget.remainingBudget,
      totalActivity:
        (budget.totalViews || 0) +
        (budget.totalLikes || 0) +
        (budget.totalComments || 0) +
        (budget.totalBookmarks || 0) +
        (budget.totalProfileViews || 0),
      weightedActivity: calculateWeightedActivity(budget),
      currentRates: {
        viewRate: budget.currentRates?.viewRate || 0,
        likeRate: budget.currentRates?.likeRate || 0,
        commentRate: budget.currentRates?.commentRate || 0,
        bookmarkRate: budget.currentRates?.bookmarkRate || 0,
        profileViewRate: budget.currentRates?.profileViewRate || 0,
      },
    }));

    console.log(`✅ Retrieved ${transformedBudgets.length} budget records`);
    return ResponseUtil.success(event, transformedBudgets);
  } catch (error) {
    console.error("❌ Error fetching budgets:", error);
    return ResponseUtil.internalError(event, "Failed to fetch daily budgets");
  }
}

/**
 * Update budget for a specific date
 */
async function handleUpdateBudget(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const date = event.pathParameters?.["date"];

  if (!date) {
    return ResponseUtil.error(event, "Date parameter is required", 400);
  }

  if (!event.body) {
    return ResponseUtil.error(event, "Request body is required", 400);
  }

  try {
    const { amount } = JSON.parse(event.body);

    if (typeof amount !== "number" || amount < 0) {
      return ResponseUtil.error(
        event,
        "Amount must be a non-negative number",
        400
      );
    }

    if (amount > 10000) {
      return ResponseUtil.error(event, "Amount cannot exceed 10,000 PSC", 400);
    }

    // Get existing budget or create new one
    let budget = await DynamoDBService.getBudgetByDate(date);

    if (!budget) {
      // Create new budget for the date
      budget = {
        PK: `PSC_BUDGET#${date}`,
        SK: "METADATA",
        GSI1PK: "PSC_BUDGET",
        GSI1SK: date,
        EntityType: "DailyBudget",
        date: date,
        totalBudget: amount,
        remainingBudget: amount,
        distributedBudget: 0,
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
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      } as DailyBudgetEntity;
    } else {
      // Update existing budget
      const distributed = budget.totalBudget - budget.remainingBudget;
      budget.totalBudget = amount;
      budget.remainingBudget = Math.max(0, amount - distributed);
      budget.lastUpdated = new Date().toISOString();

      // Recalculate rates if there's activity
      const systemConfig = PSCPayoutService.getSystemConfig();
      try {
        budget.currentRates = await PSCPayoutService.calculateCurrentRates(
          budget,
          systemConfig
        );
      } catch (error) {
        console.warn("Could not recalculate rates:", error);
      }
    }

    // Save budget to database
    await DynamoDBService.createDailyBudget(budget);

    // Transform to frontend format
    const transformedBudget = {
      date: budget.date,
      totalBudget: budget.totalBudget,
      remainingBudget: budget.remainingBudget,
      distributedAmount: budget.totalBudget - budget.remainingBudget,
      totalActivity:
        (budget.totalViews || 0) +
        (budget.totalLikes || 0) +
        (budget.totalComments || 0) +
        (budget.totalBookmarks || 0) +
        (budget.totalProfileViews || 0),
      weightedActivity: calculateWeightedActivity(budget),
      currentRates: {
        viewRate: budget.currentRates?.viewRate || 0,
        likeRate: budget.currentRates?.likeRate || 0,
        commentRate: budget.currentRates?.commentRate || 0,
        bookmarkRate: budget.currentRates?.bookmarkRate || 0,
        profileViewRate: budget.currentRates?.profileViewRate || 0,
      },
    };

    console.log(`✅ Updated budget for ${date}: ${amount} PSC`);
    return ResponseUtil.success(event, transformedBudget);
  } catch (error) {
    console.error("❌ Budget update error:", error);
    return ResponseUtil.internalError(event, "Failed to update budget");
  }
}

/**
 * Calculate weighted activity for a budget
 */
function calculateWeightedActivity(budget: DailyBudgetEntity): number {
  const config = PSCPayoutService.getSystemConfig();

  return (
    (budget.totalViews || 0) * config.rateWeights.view +
    (budget.totalLikes || 0) * config.rateWeights.like +
    (budget.totalComments || 0) * config.rateWeights.comment +
    (budget.totalBookmarks || 0) * config.rateWeights.bookmark +
    (budget.totalProfileViews || 0) * config.rateWeights.profileView
  );
}

export const handler = LambdaHandlerUtil.withAdminAuth(handlePSCBudgets);
