import { ApiUtil } from "../api-util";
import {
  PSCBalance,
  PSCBalanceResponse,
  PSCTransactionHistoryRequest,
  PSCTransactionHistoryResponse,
  PSCRatesResponse,
  PSCStatsResponse,
  TransactionEntity,
  PSCRateSnapshotsResponse,
  PSCSpendRequest,
  PSCSpendResponse,
} from "@/types/shared-types/pornspotcoin";

// PSC User API - endpoints for regular users to interact with PornSpotCoin
export const pscApi = {
  /**
   * Get current user's PSC balance and summary
   */
  getBalance: async (): Promise<PSCBalance> => {
    const response = await ApiUtil.get<PSCBalanceResponse>("/user/psc/balance");
    const data = ApiUtil.extractData(response);
    return data.balance!;
  },

  /**
   * Get user's PSC transaction history
   */
  getTransactionHistory: async (
    params: Partial<PSCTransactionHistoryRequest> = {}
  ): Promise<PSCTransactionHistoryResponse> => {
    const response = await ApiUtil.get<PSCTransactionHistoryResponse>(
      "/user/psc/transactions",
      params
    );
    const data = ApiUtil.extractData(response);
    return data;
  },

  /**
   * Get current PSC payout rates and daily budget status
   */
  getCurrentRates: async (): Promise<PSCRatesResponse> => {
    const response = await ApiUtil.get<PSCRatesResponse>("/user/psc/rates");
    const data = ApiUtil.extractData(response);
    return data;
  },

  /**
   * Get PSC dashboard data (combines balance, rates, and recent transactions)
   */
  getDashboardData: async (): Promise<{
    balance: PSCBalance;
    rates: {
      viewRate: number;
      likeRate: number;
      commentRate: number;
      bookmarkRate: number;
      profileViewRate: number;
    };
    dailyBudget: {
      total: number;
      remaining: number;
      distributed: number;
    };
    recentTransactions: TransactionEntity[];
  }> => {
    // Fetch all data in parallel for better performance
    const [balanceData, ratesData, transactionsData] = await Promise.all([
      pscApi.getBalance(),
      pscApi.getCurrentRates(),
      pscApi.getTransactionHistory({ limit: 200 }),
    ]);

    return {
      balance: balanceData,
      rates: ratesData.rates || {
        viewRate: 0,
        likeRate: 0,
        commentRate: 0,
        bookmarkRate: 0,
        profileViewRate: 0,
      },
      dailyBudget: ratesData.dailyBudget || {
        total: 0,
        remaining: 0,
        distributed: 0,
      },
      recentTransactions: transactionsData.transactions || [],
    };
  },

  /**
   * Get PSC statistics for performance insights
   */
  getStats: async (
    period: "daily" | "weekly" | "monthly" = "weekly"
  ): Promise<PSCStatsResponse> => {
    const response = await ApiUtil.get<PSCStatsResponse>("/user/psc/stats", {
      period,
    });
    const data = ApiUtil.extractData(response);
    return data;
  },

  /**
   * Get PSC rate snapshots for charting
   */
  getRateSnapshots: async (
    interval: "daily" | "weekly" = "weekly"
  ): Promise<PSCRateSnapshotsResponse> => {
    const response = await ApiUtil.get<PSCRateSnapshotsResponse>(
      "/user/psc/stats",
      {
        period: "snapshots",
        interval,
      }
    );
    const data = ApiUtil.extractData(response);
    return data;
  },

  /**
   * Spend PSC to purchase or extend a subscription plan
   */
  spend: async (payload: PSCSpendRequest): Promise<PSCSpendResponse> => {
    const response = await ApiUtil.post<PSCSpendResponse>(
      "/user/psc/spend",
      payload
    );
    const data = ApiUtil.extractData(response);
    return data;
  },
};
