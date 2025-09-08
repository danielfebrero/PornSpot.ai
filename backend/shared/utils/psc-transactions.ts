/**
 * @fileoverview PornSpotCoin Transaction Service
 * @description Service for managing PSC transactions, balance updates, and transaction recording.
 * @notes
 * - Atomic balance updates using DynamoDB transactions
 * - Transaction recording with proper GSI indexing
 * - Balance consistency validation
 * - Integration with user balance tracking
 */

import { DynamoDBService } from "./dynamodb";
import {
  TransactionEntity,
  PSCTransactionRequest,
  PSCTransactionResponse,
  PSCBalanceResponse,
  PSCBalance,
  TransactionType,
  TransactionStatus,
} from "@shared/shared-types";
import { v4 as uuidv4 } from "uuid";

export class PSCTransactionService {
  /**
   * Execute a transaction (record transaction and update user balance)
   */
  static async executeTransaction(transaction: TransactionEntity): Promise<{
    success: boolean;
    transaction?: TransactionEntity;
    error?: string;
  }> {
    try {
      // Validate transaction
      const validation = PSCTransactionService.validateTransaction(transaction);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Create the transaction record
      await DynamoDBService.createTransaction(transaction);

      // Update user balance
      if (transaction.toUserId && transaction.toUserId !== "TREASURE") {
        await PSCTransactionService.updateUserBalance(
          transaction.toUserId,
          transaction.amount,
          transaction.transactionId
        );
      }

      // If this is a user-to-user or user-to-treasure transaction, deduct from sender
      if (transaction.fromUserId && transaction.fromUserId !== "TREASURE") {
        await PSCTransactionService.updateUserBalance(
          transaction.fromUserId,
          -transaction.amount,
          transaction.transactionId
        );
      }

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      console.error("Error executing transaction:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Transaction execution failed",
      };
    }
  }

  /**
   * Create a new transaction
   */
  static async createTransaction(
    request: PSCTransactionRequest
  ): Promise<PSCTransactionResponse> {
    try {
      const transactionId = uuidv4();
      const now = new Date().toISOString();

      const transaction: TransactionEntity = {
        PK: `TRANSACTION#${transactionId}`,
        SK: "METADATA",
        GSI1PK: "TRANSACTION_BY_DATE",
        GSI1SK: `${now}#${transactionId}`,
        GSI2PK: "TRANSACTION_BY_FROM_USER",
        GSI2SK: `${request.fromUserId || "SYSTEM"}#${now}#${transactionId}`,
        GSI3PK: "TRANSACTION_BY_TO_USER",
        GSI3SK: `${request.toUserId}#${now}#${transactionId}`,
        GSI4PK: "TRANSACTION_BY_TYPE",
        GSI4SK: `${request.transactionType}#${now}#${transactionId}`,
        GSI5PK: "TRANSACTION_BY_STATUS",
        GSI5SK: `pending#${now}#${transactionId}`,
        EntityType: "Transaction",
        transactionId,
        transactionType: request.transactionType,
        status: "pending",
        amount: request.amount,
        fromUserId: request.fromUserId!, // Allow undefined for system transactions
        toUserId: request.toUserId,
        description: request.description,
        metadata: request.metadata,
        createdAt: now,
      };

      const result = await PSCTransactionService.executeTransaction(
        transaction
      );

      if (result.success) {
        // Update transaction status to completed
        await PSCTransactionService.updateTransactionStatus(
          transactionId,
          "completed"
        );

        // Get updated user balance
        const balance = await PSCTransactionService.getUserBalance(
          request.toUserId
        );

        return {
          success: true,
          transaction: result.transaction,
          balance: balance.balance?.balance,
        };
      } else {
        // Update transaction status to failed
        await PSCTransactionService.updateTransactionStatus(
          transactionId,
          "failed"
        );

        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create transaction",
      };
    }
  }

  /**
   * Update user PSC balance
   */
  static async updateUserBalance(
    userId: string,
    amount: number,
    _transactionId: string
  ): Promise<void> {
    try {
      const user = await DynamoDBService.getUserById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const currentBalance = user.pscBalance || 0;
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error(
          `Insufficient balance. Current: ${currentBalance}, Requested: ${amount}`
        );
      }

      const now = new Date().toISOString();
      const updateData: Partial<any> = {
        pscBalance: newBalance,
        pscLastTransactionAt: now,
      };

      // Update earned/spent counters
      if (amount > 0) {
        updateData["pscTotalEarned"] = (user.pscTotalEarned || 0) + amount;
      } else {
        updateData["pscTotalSpent"] =
          (user.pscTotalSpent || 0) + Math.abs(amount);
      }

      await DynamoDBService.updateUser(userId, updateData);
    } catch (error) {
      console.error("Error updating user balance:", error);
      throw error;
    }
  }

  /**
   * Get user PSC balance summary
   */
  static async getUserBalance(userId: string): Promise<PSCBalanceResponse> {
    try {
      const user = await DynamoDBService.getUserById(userId);
      if (!user) {
        return {
          success: false,
          error: "User not found",
        };
      }

      const balance: PSCBalance = {
        userId,
        balance: user.pscBalance || 0,
        totalEarned: user.pscTotalEarned || 0,
        totalSpent: user.pscTotalSpent || 0,
        totalWithdrawn: user.pscTotalWithdrawn || 0,
        lastTransactionAt: user.pscLastTransactionAt,
        lastUpdated: new Date().toISOString(),
      };

      return {
        success: true,
        balance,
      };
    } catch (error) {
      console.error("Error getting user balance:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get balance",
      };
    }
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const updateData: any = {
        status,
      };

      if (status === "completed") {
        updateData.completedAt = now;
      } else if (status === "failed") {
        updateData.failedAt = now;
      }

      await DynamoDBService.updateTransaction(transactionId, updateData);
    } catch (error) {
      console.error("Error updating transaction status:", error);
      throw error;
    }
  }

  /**
   * Validate transaction before execution
   */
  private static validateTransaction(transaction: TransactionEntity): {
    valid: boolean;
    error?: string;
  } {
    if (!transaction.toUserId) {
      return { valid: false, error: "toUserId is required" };
    }

    if (transaction.amount <= 0) {
      return { valid: false, error: "Amount must be positive" };
    }

    if (!transaction.description) {
      return { valid: false, error: "Description is required" };
    }

    if (!transaction.transactionType) {
      return { valid: false, error: "Transaction type is required" };
    }

    return { valid: true };
  }

  /**
   * Get transactions by date range
   */
  static async getTransactionsByDateRange(
    startDate: string,
    endDate: string,
    limit: number = 100,
    exclusiveStartKey?: string
  ): Promise<{
    items: TransactionEntity[];
    lastEvaluatedKey?: string;
    count: number;
  }> {
    try {
      return await DynamoDBService.getTransactionsByDateRange(
        startDate,
        endDate,
        limit,
        exclusiveStartKey
      );
    } catch (error) {
      console.error("Error getting transactions by date range:", error);
      throw error;
    }
  }

  /**
   * Get transactions by type
   */
  static async getTransactionsByType(
    transactionType: TransactionType,
    limit: number = 100,
    exclusiveStartKey?: string
  ): Promise<{
    items: TransactionEntity[];
    lastEvaluatedKey?: string;
    count: number;
  }> {
    try {
      return await DynamoDBService.getTransactionsByType(
        transactionType,
        limit,
        exclusiveStartKey
      );
    } catch (error) {
      console.error("Error getting transactions by type:", error);
      throw error;
    }
  }
}
