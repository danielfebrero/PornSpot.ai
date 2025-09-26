/**
 * @fileoverview PornSpotCoin (PSC) Shared Types
 * @description Types for transactions, payouts, balances, and PSC-related operations.
 * @notes
 * - TransactionEntity for DynamoDB storage with GSI patterns
 * - PayoutEvent types for reward calculations
 * - Transaction types for different operations (user-to-user, system-to-user, etc.)
 * - Balance operation types for atomic updates
 * - PSC rate tracking for dynamic reward distribution
 */

import { PaginationMeta } from "./core";
import type { UserPlan } from "./permissions";

// Transaction types
export type TransactionType =
  | "reward_view"
  | "reward_like"
  | "reward_comment"
  | "reward_bookmark"
  | "reward_profile_view"
  | "user_to_user"
  | "treasure_to_user"
  | "user_to_treasure"
  | "purchase"
  | "withdrawal"
  | "deposit";

export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

// Payout event types for reward calculations
export interface PayoutEvent {
  eventType: "view" | "like" | "comment" | "bookmark" | "profile_view";
  targetType: "album" | "image" | "video" | "profile" | "media";
  targetId: string;
  userId: string; // User who performed the action
  creatorId: string; // User who receives the reward
  timestamp: string;
  metadata?: {
    albumId?: string;
    mediaId?: string;
    commentId?: string;
    profileId?: string;
    [key: string]: any;
  };
}

// Transaction entity for DynamoDB
export interface TransactionEntity {
  PK: string; // TRANSACTION#{transactionId}
  SK: string; // METADATA
  GSI1PK: string; // TRANSACTION_BY_DATE
  GSI1SK: string; // {createdAt}#{transactionId}
  GSI2PK: string; // TRANSACTION_BY_FROM_USER
  GSI2SK: string; // {fromUserId}#{createdAt}#{transactionId}
  GSI3PK: string; // TRANSACTION_BY_TO_USER
  GSI3SK: string; // {toUserId}#{createdAt}#{transactionId}
  GSI4PK: string; // TRANSACTION_BY_TYPE
  GSI4SK: string; // {transactionType}#{createdAt}#{transactionId}
  GSI5PK: string; // TRANSACTION_BY_STATUS
  GSI5SK: string; // {status}#{createdAt}#{transactionId}
  EntityType: "Transaction";

  // Core transaction data
  transactionId: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  amount: number; // PSC amount (can be fractional, stored as number with decimal precision)

  // Participants
  fromUserId: string; // "TREASURE" for treasure-to-user transactions, actual userId for user transactions
  toUserId: string; // "TREASURE" for user-to-treasure transactions, actual userId for user transactions

  // Metadata
  description: string;
  metadata?: {
    eventType?: string;
    targetType?: string;
    targetId?: string;
    albumId?: string;
    mediaId?: string;
    commentId?: string;
    profileId?: string;
    rate?: number; // PSC rate at time of transaction (e.g., PSC per view)
    dailyBudget?: number; // Daily budget amount when this transaction occurred
    totalDailyDistributed?: number; // Total rewarded count for the day
    [key: string]: any;
  };

  // Timestamps
  createdAt: string;
  completedAt?: string;
  failedAt?: string;

  // Reference data
  referenceId?: string; // External reference (e.g., Solana transaction hash)
  blockchainTxHash?: string; // For actual blockchain transactions
}

// Balance operation for atomic updates
export interface BalanceOperation {
  userId: string;
  amount: number; // Positive for credit, negative for debit
  transactionId: string;
  description: string;
}

// Daily budget and rate tracking
export interface DailyBudgetEntity {
  PK: string; // PSC_BUDGET#{date}
  SK: string; // METADATA
  GSI1PK: string; // PSC_BUDGET
  GSI1SK: string; // {date}
  EntityType: "DailyBudget";

  date: string; // YYYY-MM-DD format
  totalBudget: number; // Total PSC allocated for the day
  remainingBudget: number; // PSC remaining to distribute
  distributedBudget: number; // PSC already distributed

  // Activity counters for rate calculation
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalBookmarks: number;
  totalProfileViews: number;

  // Current rates (calculated dynamically)
  currentRates: {
    viewRate: number; // PSC per view
    likeRate: number; // PSC per like
    commentRate: number; // PSC per comment
    bookmarkRate: number; // PSC per bookmark
    profileViewRate: number; // PSC per profile view
  };
  lastUpdated: string;
  createdAt: string;
}

// User view counter for tracking 10-view cycles for media views
export interface UserViewCounterEntity {
  PK: string; // USER_VIEW_COUNTER#{userId}
  SK: string; // METADATA
  EntityType: "UserViewCounter";

  userId: string;
  mediaViewCount: number; // Current count (0-9), resets to 0 when reaching 10
  totalMediaViews: number; // Total lifetime media views by this user
  lastViewAt: string; // Timestamp of last media view
  lastPayoutAt?: string; // Timestamp of last payout (every 10 views)
  createdAt: string;
  lastUpdated: string;
}

// PSC balance summary for users
export interface PSCBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  totalWithdrawn: number;
  lastTransactionAt?: string;
  lastUpdated: string;
}

// API request/response types
export interface PSCTransactionRequest {
  transactionType: TransactionType;
  amount: number;
  toUserId: string;
  fromUserId?: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface PSCTransactionResponse {
  transaction?: TransactionEntity;
  balance?: number;
}

export interface PSCSpendRequest {
  plan: UserPlan | "lifetime";
  pscAmount: number;
  metadata?: Record<string, unknown>;
}

export interface PSCSpendResponse {
  balance?: PSCBalance;
  transaction?: TransactionEntity;
  orderId?: string;
}

export interface PSCBalanceResponse {
  balance?: PSCBalance;
}

export interface PSCTransactionHistoryRequest {
  limit?: number;
  cursor?: string;
  userId: string;
  transactionType?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface PSCTransactionHistoryResponse {
  transactions?: TransactionEntity[];
  pagination: PaginationMeta;
  totalCount?: number;
}

export interface PSCRatesResponse {
  rates?: {
    viewRate: number;
    likeRate: number;
    commentRate: number;
    bookmarkRate: number;
    profileViewRate: number;
  };
  dailyBudget?: {
    total: number;
    remaining: number;
    distributed: number;
  };
}

// Payout calculation result
export interface PayoutCalculation {
  amount: number;
  rate: number;
  eventType: string;
  budgetRemaining: number;
  totalDailyActivity: number;
  shouldPayout: boolean;
  reason?: string; // If shouldPayout is false
}

// System configuration for PSC
export interface PSCSystemConfig {
  dailyBudgetAmount: number; // Total PSC to distribute per day
  minimumPayoutAmount: number; // Minimum PSC amount for payouts
  maxPayoutPerAction: number; // Maximum PSC per single action

  // Rate calculation weights
  rateWeights: {
    view: number; // Relative weight for view rewards
    like: number; // Relative weight for like rewards
    comment: number; // Relative weight for comment rewards
    bookmark: number; // Relative weight for bookmark rewards
    profileView: number; // Relative weight for profile view rewards
  };

  // Feature flags
  enableRewards: boolean;
  enableUserToUserTransfers: boolean;
  enableWithdrawals: boolean;
}

// Rate snapshot for historical tracking
export interface RateSnapshotEntity {
  PK: string; // PSC_RATE_SNAPSHOT#{date}
  SK: string; // {timestamp}#{interval} - e.g., "2024-01-15T14:05:00.000Z#5min" or "2024-01-15T14:00:00.000Z#1hour"
  GSI1PK: string; // PSC_RATE_SNAPSHOT
  GSI1SK: string; // {date}#{interval}#{timestamp}
  EntityType: "RateSnapshot";

  date: string; // YYYY-MM-DD format
  timestamp: string; // ISO 8601 timestamp
  interval: "5min" | "1hour"; // Snapshot interval type

  // Snapshot of current rates at this time
  rates: {
    viewRate: number;
    likeRate: number;
    commentRate: number;
    bookmarkRate: number;
    profileViewRate: number;
  };

  // Budget information at snapshot time
  budget: {
    total: number;
    remaining: number;
    distributed: number;
  };

  // Activity counters at snapshot time
  activity: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalBookmarks: number;
    totalProfileViews: number;
  };

  createdAt: string;
}

// Withdrawal request
export interface WithdrawalRequest {
  userId: string;
  amount: number;
  walletAddress: string;
  network?: string; // e.g., "solana", "ethereum"
}

export interface WithdrawalResponse {
  withdrawalId?: string;
  transactionId?: string;
  estimatedFee?: number;
}

// Rate snapshots response for user stats
export interface PSCRateSnapshotsResponse {
  snapshots?: RateSnapshotEntity[];
  dailySnapshots?: RateSnapshotEntity[]; // 5-minute snapshots for daily view
  weeklySnapshots?: RateSnapshotEntity[]; // Hourly snapshots for weekly view
}

// PSC stats response for user performance insights
export interface PSCStatsResponse {
  stats: {
    totalInteractions: number;
    totalViews: number;
    payoutGrowth: number;
  };
}
