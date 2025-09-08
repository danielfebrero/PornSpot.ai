import { ApiUtil } from "../api-util";
import { PaginationMeta } from "@/types/shared-types";

// Types for PSC Admin API
export interface PSCSystemConfig {
  dailyBudgetAmount: number;
  enableRewards: boolean;
  enableUserToUserTransfers: boolean;
  enableWithdrawals: boolean;
  minimumPayoutAmount: number;
  maxPayoutPerAction: number;
  rateWeights: {
    view: number;
    like: number;
    comment: number;
    bookmark: number;
    profileView: number;
  };
}

export interface DailyBudget {
  date: string;
  totalBudget: number;
  remainingBudget: number;
  distributedAmount: number;
  totalActivity: number;
  weightedActivity: number;
  currentRates: {
    viewRate: number;
    likeRate: number;
    commentRate: number;
    bookmarkRate: number;
    profileViewRate: number;
  };
}

export interface PSCTransaction {
  id: string;
  userId: string;
  username: string;
  type:
    | "view"
    | "like"
    | "comment"
    | "bookmark"
    | "profileView"
    | "transfer"
    | "withdrawal";
  amount: number;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  metadata?: {
    mediaId?: string;
    albumId?: string;
    targetUserId?: string;
    withdrawalAddress?: string;
  };
}

export interface TransactionFilters {
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  cursor?: string;
  limit?: number;
}

export interface PSCOverviewData {
  dailyBudget: {
    total: number;
    remaining: number;
    distributed: number;
    activity: {
      views: number;
      likes: number;
      comments: number;
      bookmarks: number;
      profileViews: number;
    };
  };
  currentRates: {
    viewRate: number;
    likeRate: number;
    commentRate: number;
    bookmarkRate: number;
    profileViewRate: number;
  };
  systemConfig: PSCSystemConfig;
}

export interface TransactionResponse {
  transactions: PSCTransaction[];
  pagination: PaginationMeta;
}

// Admin PSC API Functions
export const adminPSCApi = {
  // Overview
  getOverview: async (): Promise<PSCOverviewData> => {
    const response = await ApiUtil.get<PSCOverviewData>("/admin/psc/overview");
    return ApiUtil.extractData(response);
  },

  // Configuration
  getConfig: async (): Promise<PSCSystemConfig> => {
    const response = await ApiUtil.get<PSCSystemConfig>("/admin/psc/config");
    return ApiUtil.extractData(response);
  },

  updateConfig: async (
    config: Partial<PSCSystemConfig>
  ): Promise<PSCSystemConfig> => {
    const response = await ApiUtil.put<PSCSystemConfig>(
      "/admin/psc/config",
      config
    );
    return ApiUtil.extractData(response);
  },

  resetConfig: async (): Promise<PSCSystemConfig> => {
    const response = await ApiUtil.post<PSCSystemConfig>(
      "/admin/psc/config/reset"
    );
    return ApiUtil.extractData(response);
  },

  // Daily Budgets
  getBudgets: async (params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<DailyBudget[]> => {
    const response = await ApiUtil.get<DailyBudget[]>(
      "/admin/psc/budgets",
      params
    );
    return ApiUtil.extractData(response);
  },

  updateBudget: async (date: string, amount: number): Promise<DailyBudget> => {
    const response = await ApiUtil.put<DailyBudget>(
      `/admin/psc/budgets/${date}`,
      { amount }
    );
    return ApiUtil.extractData(response);
  },

  deleteBudget: async (
    date: string
  ): Promise<{ message: string; date: string }> => {
    const response = await ApiUtil.delete<{ message: string; date: string }>(
      `/admin/psc/budgets/${date}`
    );
    return ApiUtil.extractData(response);
  },

  // Transactions
  getTransactions: async (
    filters?: TransactionFilters
  ): Promise<TransactionResponse> => {
    const response = await ApiUtil.get<TransactionResponse>(
      "/admin/psc/transactions",
      filters
    );
    return ApiUtil.extractData(response);
  },
};
