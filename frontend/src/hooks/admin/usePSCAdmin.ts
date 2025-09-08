import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  page?: number;
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

// API Base URL
const API_BASE = "/api/admin/psc";

// API Functions
async function fetchPSCOverview(): Promise<PSCOverviewData> {
  const response = await fetch(`${API_BASE}/overview`);
  if (!response.ok) {
    throw new Error("Failed to fetch PSC overview");
  }
  return response.json();
}

async function fetchPSCConfig(): Promise<PSCSystemConfig> {
  const response = await fetch(`${API_BASE}/config`);
  if (!response.ok) {
    throw new Error("Failed to fetch PSC configuration");
  }
  return response.json();
}

async function updatePSCConfig(
  config: PSCSystemConfig
): Promise<PSCSystemConfig> {
  const response = await fetch(`${API_BASE}/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error("Failed to update PSC configuration");
  }
  return response.json();
}

async function fetchDailyBudgets(limit = 30): Promise<DailyBudget[]> {
  const response = await fetch(`${API_BASE}/budgets?limit=${limit}`);
  if (!response.ok) {
    throw new Error("Failed to fetch daily budgets");
  }
  return response.json();
}

async function updateDailyBudget(
  date: string,
  amount: number
): Promise<DailyBudget> {
  const response = await fetch(`${API_BASE}/budgets/${date}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    throw new Error("Failed to update daily budget");
  }
  return response.json();
}

async function fetchTransactions(filters: TransactionFilters = {}): Promise<{
  transactions: PSCTransaction[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(`${API_BASE}/transactions?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }
  return response.json();
}

async function exportTransactions(
  filters: TransactionFilters = {}
): Promise<Blob> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(
    `${API_BASE}/transactions/export?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Failed to export transactions");
  }
  return response.blob();
}

async function resetPSCConfig(): Promise<PSCSystemConfig> {
  const response = await fetch(`${API_BASE}/config/reset`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to reset PSC configuration");
  }
  return response.json();
}

// React Query Hooks

/**
 * Hook to fetch PSC system overview data
 */
export function usePSCOverview() {
  return useQuery({
    queryKey: ["psc", "overview"],
    queryFn: fetchPSCOverview,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Hook to fetch PSC system configuration
 */
export function usePSCConfig() {
  return useQuery({
    queryKey: ["psc", "config"],
    queryFn: fetchPSCConfig,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to update PSC system configuration
 */
export function useUpdatePSCConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePSCConfig,
    onSuccess: (data) => {
      // Update the config cache
      queryClient.setQueryData(["psc", "config"], data);
      // Invalidate overview to refresh derived data
      queryClient.invalidateQueries({ queryKey: ["psc", "overview"] });
    },
  });
}

/**
 * Hook to reset PSC configuration to defaults
 */
export function useResetPSCConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetPSCConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(["psc", "config"], data);
      queryClient.invalidateQueries({ queryKey: ["psc", "overview"] });
    },
  });
}

/**
 * Hook to fetch daily budgets
 */
export function useDailyBudgets(limit = 30) {
  return useQuery({
    queryKey: ["psc", "budgets", limit],
    queryFn: () => fetchDailyBudgets(limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to update a daily budget
 */
export function useUpdateDailyBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      updateDailyBudget(date, amount),
    onSuccess: (updatedBudget) => {
      // Update the budgets cache
      queryClient.setQueryData(
        ["psc", "budgets"],
        (oldData: DailyBudget[] | undefined) => {
          if (!oldData) return [updatedBudget];
          return oldData.map((budget) =>
            budget.date === updatedBudget.date ? updatedBudget : budget
          );
        }
      );
      // Invalidate overview for updated current budget
      queryClient.invalidateQueries({ queryKey: ["psc", "overview"] });
    },
  });
}

/**
 * Hook to fetch transactions with filters
 */
export function usePSCTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["psc", "transactions", filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to export transactions
 */
export function useExportTransactions() {
  return useMutation({
    mutationFn: exportTransactions,
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename with current date
      const date = new Date().toISOString().split("T")[0];
      link.download = `psc-transactions-${date}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}

/**
 * Hook to refresh all PSC data
 */
export function useRefreshPSCData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // This doesn't call an API, just invalidates all PSC queries
      await queryClient.invalidateQueries({ queryKey: ["psc"] });
    },
  });
}
