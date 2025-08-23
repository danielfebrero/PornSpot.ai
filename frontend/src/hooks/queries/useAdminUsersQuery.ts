import {
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { adminUsersApi, AdminUsersResponse } from "@/lib/api/admin-users";

// Hook for fetching admin users list with infinite scroll support
export function useAdminUsersQuery(params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.admin.users.list({ limit }),
    queryFn: async ({ pageParam }): Promise<AdminUsersResponse> => {
      return await adminUsersApi.getUsers({
        limit,
        lastEvaluatedKey: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// Hook for disabling users
export function useDisableUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminUsersApi.disableUser,
    onSuccess: () => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all() });
    },
    onError: (error) => {
      console.error("Failed to disable user:", error);
    },
  });
}

// Hook for enabling users
export function useEnableUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminUsersApi.enableUser,
    onSuccess: () => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all() });
    },
    onError: (error) => {
      console.error("Failed to enable user:", error);
    },
  });
}
