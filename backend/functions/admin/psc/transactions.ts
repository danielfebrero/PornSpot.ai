import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import {
  PaginationUtil,
  DEFAULT_PAGINATION_LIMITS,
  MAX_PAGINATION_LIMITS,
} from "@shared/utils/pagination";

/**
 * @fileoverview PSC Admin Transactions Handler
 * @description Retrieves PSC transaction history with filtering and pagination.
 * @auth Requires admin authentication.
 * @returns Paginated transaction history with filtering options.
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

    const { cursor: _lastEvaluatedKey, limit } = paginationParams;
    // Note: _lastEvaluatedKey would be used in real DynamoDB implementation

    // Parse additional filter parameters
    const {
      type = "all",
      status = "all",
      dateFrom,
      dateTo,
      userId,
    } = event.queryStringParameters || {};

    // Build filters object
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

    // Get transactions from DynamoDB
    // Note: This would need to be implemented in DynamoDBService
    // For now, return mock data that matches the expected structure
    const mockTransactions = [
      {
        id: "tx_001",
        userId: "user_123",
        username: "alexsmith",
        type: "like",
        amount: 0.21,
        status: "completed",
        timestamp: "2025-09-07T14:30:00Z",
        metadata: { mediaId: "media_456" },
      },
      {
        id: "tx_002",
        userId: "user_789",
        username: "sarahj",
        type: "comment",
        amount: 0.35,
        status: "completed",
        timestamp: "2025-09-07T14:15:00Z",
        metadata: { mediaId: "media_789" },
      },
      {
        id: "tx_003",
        userId: "user_456",
        username: "mikewilson",
        type: "view",
        amount: 0.035,
        status: "completed",
        timestamp: "2025-09-07T14:00:00Z",
        metadata: { mediaId: "media_123" },
      },
      {
        id: "tx_004",
        userId: "user_321",
        username: "emilybrown",
        type: "transfer",
        amount: -5.0,
        status: "completed",
        timestamp: "2025-09-07T13:45:00Z",
        metadata: { targetUserId: "user_654" },
      },
      {
        id: "tx_005",
        userId: "user_654",
        username: "davidlee",
        type: "transfer",
        amount: 5.0,
        status: "completed",
        timestamp: "2025-09-07T13:45:00Z",
        metadata: { targetUserId: "user_321" },
      },
    ];

    // Apply client-side filtering for demo (in real implementation this would be done in DynamoDB query)
    let filteredTransactions = mockTransactions;

    if (filters.type) {
      filteredTransactions = filteredTransactions.filter(
        (tx) => tx.type === filters.type
      );
    }
    if (filters.status) {
      filteredTransactions = filteredTransactions.filter(
        (tx) => tx.status === filters.status
      );
    }
    if (filters.userId) {
      filteredTransactions = filteredTransactions.filter(
        (tx) =>
          tx.username.toLowerCase().includes(filters.userId.toLowerCase()) ||
          tx.userId.toLowerCase().includes(filters.userId.toLowerCase())
      );
    }

    // Apply pagination using cursor (for demo, just slice by limit)
    // In real implementation, would use lastEvaluatedKey for DynamoDB query
    const paginatedTransactions = filteredTransactions.slice(0, limit);

    // For demo purposes, simulate lastEvaluatedKey if there are more items
    const nextKey =
      paginatedTransactions.length === limit &&
      filteredTransactions.length > limit
        ? { id: paginatedTransactions[paginatedTransactions.length - 1]?.id }
        : undefined;

    // Build typed paginated payload
    const payload = PaginationUtil.createPaginatedResponse(
      "transactions",
      paginatedTransactions,
      nextKey,
      limit
    );

    console.log("✅ PSC transactions retrieved successfully", {
      transactionCount: paginatedTransactions.length,
      hasNext: !!nextKey,
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
