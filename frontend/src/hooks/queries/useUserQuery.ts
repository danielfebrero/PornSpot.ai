import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { userApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";
import { useUserContext } from "@/contexts/UserContext";
import {
  UserLoginRequest,
  UserRegistrationRequest,
  UserProfileUpdateRequest,
  UserMeResponse,
  GetNotificationsRequest,
  UnifiedNotificationsResponse,
} from "@/types";

// Hook for updating user profile
export function useUpdateUserProfile() {
  return useMutation({
    mutationFn: async (updates: UserProfileUpdateRequest) => {
      return await userApi.updateProfile(updates);
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.user.profile() });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData(
        queryKeys.user.profile()
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.user.profile(),
        (old: UserMeResponse | undefined) => {
          return old ? { ...old, ...updates } : old;
        }
      );

      return { previousProfile };
    },
    onError: (error, variables, context) => {
      console.error("Failed to update profile:", error);

      // Rollback optimistic update
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.user.profile(),
          context.previousProfile
        );
      }
    },
    onSuccess: (updatedProfile) => {
      // Ensure cache is up to date with server response
      queryClient.setQueryData(queryKeys.user.profile(), updatedProfile);
    },
  });
}

// Hook for email verification
export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      return await userApi.verifyEmail(token);
    },
    onSuccess: () => {
      // Refresh user profile after email verification
      invalidateQueries.user();
    },
  });
}

// Hook for resending verification email
export function useResendVerification() {
  return useMutation({
    mutationFn: async (email: string) => {
      return await userApi.resendVerification(email);
    },
  });
}

// Hook for user logout
export function useLogout() {
  const userContext = useUserContext();

  return useMutation({
    mutationFn: async () => {
      return await userApi.logout();
    },
    onMutate: () => {
      // Clear all cached data immediately when logout is initiated
      queryClient.clear();
      // Clear UserContext user state immediately
      userContext.clearUser();
    },
  });
}

// Hook for user login (for cache invalidation after successful login)
export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: UserLoginRequest) => {
      return await userApi.login(credentials);
    },
    onSuccess: () => {
      // Invalidate user profile to refetch after successful login
      invalidateQueries.user();
    },
  });
}

// Hook to manually refresh user profile (useful when navigating to login)
export function useRefreshUserProfile() {
  return () => {
    // Invalidate the user profile query to allow fresh authentication attempt
    invalidateQueries.user();
  };
}

// Hook for fetching public user profile by username
export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: queryKeys.user.publicProfile(username),
    queryFn: async () => {
      return await userApi.getPublicProfile(username);
    },
    // Keep public profiles fresh for 10 minutes
    staleTime: 10 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
    // Retry on failures (public profiles are more stable)
    retry: 2,
    // Only query if username is provided
    enabled: !!username,
  });
}

export function useGetMinimalUser({
  userId,
  username,
}: {
  userId?: string;
  username?: string;
}) {
  return useQuery({
    queryKey: queryKeys.user.minimalUser({ userId, username }),
    queryFn: async () => {
      return await userApi.getMinimalUser({ userId, username });
    },
    // Keep minimal profiles fresh for 10 minutes
    staleTime: 10 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
    // Retry on failures (minimal profiles are more stable)
    retry: 2,
    // Only query if userId or username is provided
    enabled: !!(userId || username),
  });
}

// Hook for user registration
export function useRegister() {
  return useMutation({
    mutationFn: async (userData: UserRegistrationRequest) => {
      return await userApi.register(userData);
    },
    onSuccess: () => {
      // Invalidate user profile to refetch after successful registration
      invalidateQueries.user();
    },
  });
}

// Hook for checking auth (manual refresh)
export function useCheckAuth() {
  return useMutation({
    mutationFn: async () => {
      return await userApi.me();
    },
    onSuccess: (data) => {
      // Update cache with fresh user data
      queryClient.setQueryData(queryKeys.user.profile(), data);
    },
  });
}

// Hook for fetching user notifications
export function useNotifications(params?: GetNotificationsRequest) {
  const { user } = useUserContext();

  return useInfiniteQuery({
    queryKey: queryKeys.user.notifications.list(params),
    queryFn: async ({ pageParam }) => {
      return await userApi.getNotifications({ ...params, cursor: pageParam });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: UnifiedNotificationsResponse) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },

    // Notifications should be fresh for 1 minute
    staleTime: 1 * 60 * 1000,
    // Keep notifications in cache for 1 minute
    gcTime: 1 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
    // Only fetch if user is logged in
    enabled: !!user,
    // Retry on failures
    retry: 2,
  });
}

// Hook for fetching unread notification count
export function useUnreadNotificationCount() {
  const { user } = useUserContext();

  return useQuery({
    queryKey: queryKeys.user.notifications.unreadCount(),
    queryFn: async () => {
      return await userApi.getUnreadNotificationCount();
    },
    // Count should be fresh for 30 seconds
    staleTime: 30 * 1000,
    // Keep count in cache for 2 minutes
    gcTime: 2 * 60 * 1000,
    // Enable background refetching to keep count up to date
    refetchOnWindowFocus: true,
    // Refetch interval to keep count updated (every 30 seconds)
    refetchInterval: 30 * 1000,
    // Only fetch if user is logged in
    enabled: !!user,
    // Retry on failures
    retry: 2,
  });
}
