import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";
import { DynamoDBService } from "@shared/utils/dynamodb";

/**
 * @fileoverview PSC Admin Transactions Handler
 * @description Retrieves PSC transaction history with filtering and pagination from DynamoDB.
 * @auth Requires admin authentication.
 * @returns Paginated transaction history with filtering options and user lookup.
 */
const handlePSCTransactions = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/psc/transactions handler called");
  try {
    // Parse pagination parameters using unified utility
    let paginationParams;
    try {
      paginationParams = PaginationUtil.parseRequestParams(
        event.queryStringParameters as Record<string, string> | null,
        DEFAULT_PAGINATION_LIMITS.admin,
        MAX_PAGINATION_LIMITS.admin
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Invalid pagination parameters";
      return ResponseUtil.badRequest(event, errorMessage);
    }

    const { cursor, limit } = paginationParams;

    // Parse additional filter parameters
    const {
      type = "all",
      status = "all",
      dateFrom,
      dateTo,
      userId,
    } = event.queryStringParameters || {};

    // Build filters object for DynamoDB query
    const filters: any = {};
    if (type !== "all") {
      filters.type = type;
    }
    if (status !== "all") {
      filters.status = status;
    }
    if (dateFrom) {
      filters.dateFrom = dateFrom;
    }
    if (dateTo) {
      filters.dateTo = dateTo;
    }
    if (userId) {
      filters.userId = userId;
    }

    // Get transactions from DynamoDB using the admin method
    const result = await DynamoDBService.getAdminTransactions({
      limit,
      lastEvaluatedKey: cursor,
      ...filters,
    });

    // Convert transaction entities to admin API format with username lookup
    const transactionsWithUsernames = await Promise.all(
      result.items.map(async (transaction) => {
        return await DynamoDBService.convertTransactionEntityToAdminFormat(
          transaction
        );
      })
    );

    // Build typed paginated payload
    const payload = PaginationUtil.createPaginatedResponse(
      "transactions",
      transactionsWithUsernames,
      result.lastEvaluatedKey,
      limit
    );

    console.log("✅ PSC transactions retrieved successfully", {
      transactionCount: transactionsWithUsernames.length,
      hasNext: !!result.lastEvaluatedKey,
      limit,
    });

    return ResponseUtil.success(event, payload);
  } catch (error) {
    console.error("❌ Error retrieving PSC transactions:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to retrieve transactions";
    return ResponseUtil.error(event, errorMessage);
  }
};

// Export the handler with admin authentication
export const handler = LambdaHandlerUtil.withAdminAuth(handlePSCTransactions);
