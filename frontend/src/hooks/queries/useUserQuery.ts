import { useQuery, useMutation } from "@tanstack/react-query";
import { userApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";
import { useUserContext } from "@/contexts/UserContext";
import { UserLoginRequest, UserRegistrationRequest, UserProfileUpdateRequest, UserMeResponse } from "@/types";

// Hook for fetching current user profile
export function useUserProfile() {
  const userContext = useUserContext();

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: async () => {
      return await userApi.me();
    },
    // Keep user profile fresh for 5 minutes
    staleTime: () => {
      // If we have user data, keep fresh for 5 minutes
      return 5 * 60 * 1000;
    },
    // Only refetch on window focus if we don't have authentication errors
    refetchOnWindowFocus: () => {
      return true;
    },
    // Don't retry authentication errors
    retry: false,
    // Prevent automatic queries when UserContext indicates no authentication
    enabled: (() => {
      // If UserContext is still initializing, wait for it
      if (userContext?.initializing) {
        return false;
      }

      // If UserContext has definitively determined there's no user and isn't loading,
      // and we don't already have cached data, don't query
      if (!userContext?.user && !userContext?.loading) {
        return false;
      }

      // Otherwise, allow the query to proceed
      return true;
    })(),
    // If UserContext already has user data, initialize the cache with it
    initialData: userContext?.user
      ? {
          success: true,
          data: { user: userContext.user },
        }
      : undefined,
  });
}

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
      queryClient.setQueryData(queryKeys.user.profile(), (old: UserMeResponse | undefined) => {
        return old ? { ...old, ...updates } : old;
      });

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
      if (data.success && data.data?.user) {
        queryClient.setQueryData(queryKeys.user.profile(), data);
      }
    },
  });
}
