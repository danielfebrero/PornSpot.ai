/**
 * @fileoverview User PSC Transaction History API
 * @description API endpoint for users to view their PSC transaction history
 * @notes
 * - Returns paginated user transaction history
 * - Supports filtering by transaction type and status
 * - Uses unified pagination utility with cursor-based pagination
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { TransactionType, TransactionStatus } from "@shared/shared-types";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handlePSCTransactions = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("📋 /user/psc/transactions handler called");

  try {
    const userId = auth.userId;
    const queryParams = event.queryStringParameters || {};

    // Parse pagination parameters using unified utility
    let paginationParams;
    try {
      paginationParams = PaginationUtil.parseRequestParams(
        event.queryStringParameters as Record<string, string> | null,
        DEFAULT_PAGINATION_LIMITS.pscTransactions,
        MAX_PAGINATION_LIMITS.pscTransactions
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Invalid pagination parameters";
      return ResponseUtil.badRequest(event, errorMessage);
    }

    const { cursor: lastEvaluatedKey, limit } = paginationParams;

    // Parse optional filter parameters
    const transactionType = queryParams["transactionType"] as
      | TransactionType
      | undefined;
    const status = queryParams["status"] as TransactionStatus | undefined;

    // Get transaction history using DynamoDB service directly for proper pagination
    const result = await DynamoDBService.getTransactionsByUser(
      userId,
      limit,
      lastEvaluatedKey,
      transactionType,
      status
    );

    // Build typed paginated payload
    const payload = PaginationUtil.createPaginatedResponse(
      "transactions",
      result.items,
      result.lastEvaluatedKey,
      limit
    );

    return ResponseUtil.success(event, payload);
  } catch (error) {
    console.error("Error fetching PSC transaction history:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error
        ? error.message
        : "Failed to fetch transaction history"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handlePSCTransactions, {
  requireBody: false,
});
