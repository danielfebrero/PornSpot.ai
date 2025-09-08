import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { pscApi } from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import {
  PSCBalance,
  PSCTransactionHistoryRequest,
  TransactionEntity,
} from "@/types/shared-types/pornspotcoin";

/**
 * Hook to get current user's PSC balance
 */
export function usePSCBalance() {
  return useQuery({
    queryKey: queryKeys.psc.balance(),
    queryFn: () => pscApi.getBalance(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get current PSC rates and daily budget
 */
export function usePSCRates() {
  return useQuery({
    queryKey: queryKeys.psc.rates(),
    queryFn: () => pscApi.getCurrentRates(),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute for live rates
  });
}

/**
 * Hook to get PSC dashboard data (balance, rates, and recent transactions)
 */
export function usePSCDashboard() {
  return useQuery({
    queryKey: queryKeys.psc.dashboard(),
    queryFn: () => pscApi.getDashboardData(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute for live updates
  });
}

/**
 * Hook to get PSC transaction history with pagination
 */
export function usePSCTransactionHistory(
  params: Partial<PSCTransactionHistoryRequest> = {}
) {
  return useQuery({
    queryKey: queryKeys.psc.transactions(params),
    queryFn: () => pscApi.getTransactionHistory(params),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for infinite scroll transaction history
 */
export function usePSCTransactionHistoryInfinite(
  params: Partial<PSCTransactionHistoryRequest> = {}
) {
  return useInfiniteQuery({
    queryKey: ["psc", "transactions", "infinite", params],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const result = await pscApi.getTransactionHistory({
        ...params,
        exclusiveStartKey: pageParam,
      });
      return result;
    },
    getNextPageParam: (lastPage) => lastPage.lastEvaluatedKey,
    initialPageParam: undefined as string | undefined,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get PSC statistics for different periods
 */
export function usePSCStats(period: "daily" | "weekly" | "monthly" = "weekly") {
  return useQuery({
    queryKey: queryKeys.psc.stats(period),
    queryFn: () => pscApi.getStats(period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Hook to get PSC rate snapshots for charting
 */
export function usePSCRateSnapshots(interval: "daily" | "weekly" = "weekly") {
  return useQuery({
    queryKey: queryKeys.psc.rateSnapshots(interval),
    queryFn: () => pscApi.getRateSnapshots(interval),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Utility functions for PSC-related cache invalidation
 */
export const pscQueryUtils = {
  invalidateAll: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.psc.all() });
  },

  invalidateBalance: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.psc.balance() });
  },

  invalidateRates: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.psc.rates() });
  },

  invalidateDashboard: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.psc.dashboard() });
  },

  invalidateTransactions: () => {
    queryClient.invalidateQueries({
      queryKey: ["psc", "transactions"],
      type: "all",
    });
  },

  /**
   * Optimistically update PSC balance (for when user earns PSC)
   */
  updateBalanceOptimistically: (newAmount: number) => {
    queryClient.setQueryData(
      queryKeys.psc.balance(),
      (oldData: PSCBalance | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          balance: oldData.balance + newAmount,
          totalEarned: oldData.totalEarned + newAmount,
          lastUpdated: new Date().toISOString(),
        };
      }
    );
  },

  /**
   * Add new transaction optimistically to transaction history
   */
  addTransactionOptimistically: (
    transaction: Pick<
      TransactionEntity,
      | "transactionId"
      | "transactionType"
      | "amount"
      | "status"
      | "description"
      | "createdAt"
      | "completedAt"
      | "fromUserId"
      | "toUserId"
    >
  ) => {
    // Update first page of infinite query
    queryClient.setQueryData(
      ["psc", "transactions", "infinite", {}],
      (oldData: any) => {
        if (!oldData) return oldData;

        const firstPage = oldData.pages[0];
        if (!firstPage) return oldData;

        return {
          ...oldData,
          pages: [
            {
              ...firstPage,
              transactions: [transaction, ...firstPage.transactions],
            },
            ...oldData.pages.slice(1),
          ],
        };
      }
    );

    // Update dashboard data if it includes recent transactions
    queryClient.setQueryData(queryKeys.psc.dashboard(), (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        recentTransactions: [
          transaction,
          ...oldData.recentTransactions.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  },
};

/**
 * Hook for when a PSC-earning action is performed (like, comment, etc.)
 * This can be used to optimistically update the UI
 */
export function usePSCEarningAction() {
  return {
    onEarning: (amount: number, transactionType: string) => {
      // Update balance optimistically
      pscQueryUtils.updateBalanceOptimistically(amount);

      // Optionally create a temporary transaction entry
      const tempTransaction = {
        transactionId: `temp-${Date.now()}`,
        transactionType: transactionType as any,
        amount,
        status: "completed" as const,
        description: `${transactionType} reward`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        fromUserId: "TREASURE",
        toUserId: "current-user", // This should be replaced with actual user ID
      };

      pscQueryUtils.addTransactionOptimistically(tempTransaction);

      // Refetch to get accurate server state
      setTimeout(() => {
        pscQueryUtils.invalidateBalance();
        pscQueryUtils.invalidateTransactions();
      }, 2000);
    },
  };
}
