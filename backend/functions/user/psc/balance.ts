/**
 * @fileoverview User PSC Balance API
 * @description API endpoint for users to view their current PSC balance and summary
 * @notes
 * - Returns user's current PSC balance
 * - Includes total earned, spent, and withdrawn amounts
 * - Shows last transaction timestamp
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { PSCTransactionService } from "@shared/utils/psc-transactions";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handlePSCBalance = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("💰 /user/psc/balance handler called");

  try {
    const userId = auth.userId;

    // Get user's PSC balance using existing service
    const balanceResponse = await PSCTransactionService.getUserBalance(userId);

    if (!balanceResponse.success) {
      console.error("Failed to fetch PSC balance:", balanceResponse.error);
      return ResponseUtil.error(
        event,
        balanceResponse.error || "Failed to fetch PSC balance"
      );
    }

    // ResponseUtil.success already wraps in {success: true, data: ...}
    // Just pass the balance data directly
    return ResponseUtil.success(event, {
      balance: (balanceResponse as any).balance,
    });
  } catch (error) {
    console.error("Error fetching PSC balance:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to fetch PSC balance"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handlePSCBalance, {
  requireBody: false,
});
