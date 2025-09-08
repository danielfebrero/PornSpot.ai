/**
 * @fileoverview User PSC Rates API
 * @description API endpoint for users to view current PSC payout rates and daily budget status
 * @notes
 * - Returns current PSC rates for different actions (view, like, comment, bookmark, profile view)
 * - Shows daily budget information (total, remaining, distributed)
 * - Rates are dynamically calculated based on current activity and remaining budget
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { PSCPayoutService } from "@shared/utils/psc-payout";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handlePSCRates = async (
  event: APIGatewayProxyEvent,
  _auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("📊 /user/psc/rates handler called");

  try {
    // Get current rates and daily budget summary using existing services
    const [rates, dailyBudget] = await Promise.all([
      PSCPayoutService.getCurrentRates(),
      PSCPayoutService.getDailyBudgetSummary(),
    ]);

    // ResponseUtil.success already wraps in {success: true, data: ...}
    // Just pass the data directly
    return ResponseUtil.success(event, {
      rates,
      dailyBudget,
    });
  } catch (error) {
    console.error("Error fetching PSC rates:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to fetch PSC rates"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handlePSCRates, {
  requireBody: false,
});
