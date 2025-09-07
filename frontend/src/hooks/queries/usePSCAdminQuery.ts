import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import {
  adminPSCApi,
  DailyBudget,
  TransactionFilters,
} from "@/lib/api/admin-psc";

// Hook for fetching PSC overview data
export function usePSCOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.admin.psc.overview(),
    queryFn: adminPSCApi.getOverview,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook for fetching PSC system configuration
export function usePSCConfigQuery() {
  return useQuery({
    queryKey: queryKeys.admin.psc.config(),
    queryFn: adminPSCApi.getConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

// Hook for fetching daily budgets
export function usePSCBudgetsQuery(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.admin.psc.budgets(params),
    queryFn: () => adminPSCApi.getBudgets(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook for fetching PSC transactions
export function usePSCTransactionsQuery(filters?: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.admin.psc.transactions(
      filters as Record<string, unknown>
    ),
    queryFn: () => adminPSCApi.getTransactions(filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Mutation hook for updating PSC configuration
export function usePSCConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminPSCApi.updateConfig,
    onSuccess: (data) => {
      // Update the cached config
      queryClient.setQueryData(queryKeys.admin.psc.config(), data);
      // Invalidate overview to reflect config changes
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.psc.overview(),
      });
    },
    onError: (error) => {
      console.error("Failed to update PSC configuration:", error);
    },
  });
}

// Mutation hook for resetting PSC configuration
export function usePSCConfigResetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminPSCApi.resetConfig,
    onSuccess: (data) => {
      // Update the cached config
      queryClient.setQueryData(queryKeys.admin.psc.config(), data);
      // Invalidate overview to reflect config changes
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.psc.overview(),
      });
    },
    onError: (error) => {
      console.error("Failed to reset PSC configuration:", error);
    },
  });
}

// Mutation hook for updating daily budget
export function usePSCBudgetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      adminPSCApi.updateBudget(date, amount),
    onMutate: async ({ date, amount }) => {
      // Cancel any outgoing refetches for all budget queries
      await queryClient.cancelQueries({
        queryKey: ["admin", "psc", "budgets"],
      });

      // Get all matching query keys and update them
      const queryCache = queryClient.getQueryCache();
      const previousData = new Map();

      queryCache
        .findAll({ queryKey: ["admin", "psc", "budgets"] })
        .forEach((query) => {
          const queryKey = query.queryKey;
          const currentData = queryClient.getQueryData<DailyBudget[]>(queryKey);

          if (currentData) {
            // Store previous data for rollback
            previousData.set(queryKey, currentData);

            // Optimistically update the cache
            queryClient.setQueryData<DailyBudget[]>(queryKey, (old) => {
              if (!old) return old;
              return old.map((budget) =>
                budget.date === date
                  ? {
                      ...budget,
                      totalBudget: amount,
                      // Calculate remaining budget correctly: new total - already distributed
                      remainingBudget: Math.max(
                        0,
                        amount - (budget.totalBudget - budget.remainingBudget)
                      ),
                    }
                  : budget
              );
            });
          }
        });

      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back all affected queries
      if (context?.previousData) {
        context.previousData.forEach((data, queryKey) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error("Failed to update budget:", err);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ["admin", "psc", "budgets"],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.psc.overview(),
      });
    },
  });
}
