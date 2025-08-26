import { QueryClient } from "@tanstack/react-query";
import type {
  ApiResponse,
  Album,
  Media,
  UserInteraction,
  UnifiedAlbumsResponse,
  UnifiedMediaResponse,
  UnifiedPaginationMeta,
  InteractionStatus,
  InteractionStatusResponse,
} from "@/types";

// Error type for React Query retry function
interface QueryError {
  response?: {
    status: number;
  };
  message?: string;
}

interface AlbumsListData {
  albums: Album[];
  pagination?: UnifiedPaginationMeta;
}

interface InfiniteQueryPage<T> {
  data: T;
  pagination?: UnifiedPaginationMeta;
}

interface InfiniteQueryData<T> {
  pages: InfiniteQueryPage<T>[];
  pageParams: unknown[];
}

// Default query options that apply to all queries
const defaultQueryOptions = {
  queries: {
    // Cache data for 5 minutes by default
    staleTime: 5 * 60 * 1000,
    // Keep data in cache for 30 minutes even if unused
    gcTime: 30 * 60 * 1000,
    // Retry failed requests up to 3 times with exponential backoff
    retry: (failureCount: number, error: unknown) => {
      const queryError = error as QueryError;
      // Don't retry 4xx errors (client errors)
      if (
        queryError?.response?.status != null &&
        queryError.response.status >= 400 &&
        queryError.response.status < 500
      ) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    // Refetch on window focus for critical data
    refetchOnWindowFocus: true,
    // Refetch on reconnect by default (can be overridden per query)
    refetchOnReconnect: true,
    // Enable background refetching
    refetchOnMount: true,
  },
  mutations: {
    // Retry mutations once on failure
    retry: 1,
  },
};

// Create a singleton query client
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

// Query keys factory for consistent key management
export const queryKeys = {
  // User-related queries
  user: {
    profile: () => ["user", "profile"] as const,
    publicProfile: (username: string) =>
      ["user", "publicProfile", username] as const,
    sessions: () => ["user", "sessions"] as const,
    interactions: {
      all: () => ["user", "interactions"] as const,
      bookmarks: (params?: {
        page?: number;
        limit?: number;
        lastKey?: string;
      }) => ["user", "interactions", "bookmarks", params] as const,
      likes: (params?: { page?: number; limit?: number; lastKey?: string }) =>
        ["user", "interactions", "likes", params] as const,
      comments: (params?: {
        username: string;
        page?: number;
        limit?: number;
        lastKey?: string;
      }) => ["user", "interactions", "comments", params] as const,
      status: (
        targets: Array<{
          targetType: "album" | "media" | "comment";
          targetId: string;
        }>
      ) => ["user", "interactions", "status", targets] as const,
      insights: () => ["user", "interactions", "insights"] as const,
    },
    notifications: {
      all: () => ["user", "notifications"] as const,
      list: (params?: { cursor?: string; limit?: number }) =>
        ["user", "notifications", "list", params] as const,
      unreadCount: () => ["user", "notifications", "unreadCount"] as const,
    },
  },

  // Album-related queries
  albums: {
    all: () => ["albums"] as const,
    lists: () => ["albums", "list"] as const,
    list: (params?: {
      user?: string;
      isPublic?: boolean;
      limit?: number;
      cursor?: string;
      tag?: string;
    }) => ["albums", "list", params] as const,
    detail: (albumId: string) => ["albums", "detail", albumId] as const,
    media: (albumId: string, params?: { limit?: number; cursor?: string }) =>
      ["albums", "detail", albumId, "media", params] as const,
  },

  // Media-related queries
  media: {
    all: () => ["media"] as const,
    detail: (mediaId: string) => ["media", "detail", mediaId] as const,
    recommendations: (mediaId: string) =>
      ["media", "recommendations", mediaId] as const,
  },

  // Content-related queries (public, no auth required)
  content: {
    all: () => ["content"] as const,
    viewCounts: (
      targets: Array<{
        targetType: "album" | "media";
        targetId: string;
      }>
    ) => ["content", "viewCounts", targets] as const,
  },

  // Admin-related queries
  admin: {
    all: () => ["admin"] as const,
    profile: () => ["admin", "profile"] as const,
    albums: {
      all: () => ["admin", "albums"] as const,
      list: (params?: Record<string, unknown>) =>
        ["admin", "albums", "list", params] as const,
    },
    media: {
      all: () => ["admin", "media"] as const,
      list: (albumIds: string[]) =>
        ["admin", "media", "list", albumIds] as const,
      album: (albumId: string, params?: Record<string, unknown>) =>
        ["admin", "media", "album", albumId, params] as const,
    },
    stats: () => ["admin", "stats"] as const,
    users: {
      all: () => ["admin", "users"] as const,
      list: (params?: Record<string, unknown>) =>
        ["admin", "users", "list", params] as const,
      detail: (userId: string) => ["admin", "users", "detail", userId] as const,
    },
    analytics: {
      all: () => ["admin", "analytics"] as const,
      metrics: (params: {
        metricType: string;
        granularity: string;
        startDate: string;
        endDate: string;
      }) => ["admin", "analytics", "metrics", params] as const,
      dashboard: () => ["admin", "analytics", "dashboard"] as const,
    },
  },

  // Comments
  comments: {
    all: () => ["comments"] as const,
    byTarget: (targetType: "album" | "media", targetId: string) =>
      ["comments", targetType, targetId] as const,
  },

  // Generation
  generation: {
    all: () => ["generation"] as const,
    usageStats: () => ["generation", "usage-stats"] as const,
  },

  // Discover
  discover: {
    all: () => ["discover"] as const,
    list: (params?: { limit?: number; tag?: string }) =>
      ["discover", "list", params] as const,
  },
} as const;

// Utility functions for cache invalidation
export const invalidateQueries = {
  // Invalidate all user data
  user: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() }),

  // Invalidate user interactions
  userInteractions: () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.interactions.all(),
    }),

  // Invalidate user notifications
  userNotifications: () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.notifications.all(),
    }),

  // Invalidate unread notification count
  userNotificationCount: () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.notifications.unreadCount(),
    }),

  // Invalidate specific album
  album: (albumId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.albums.detail(albumId),
    }),

  // Invalidate album media queries (for albums.media queries)
  albumMedia: (albumId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.albums.media(albumId),
    }),

  // Invalidate album media list queries (for media.album queries used by useAlbumMedia)
  albumMediaList: (albumId: string) =>
    queryClient.invalidateQueries({
      queryKey: ["media", "album", albumId],
    }),

  // Invalidate all albums lists
  albumsLists: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.albums.lists() }),

  // Invalidate specific media
  media: (mediaId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.media.detail(mediaId),
    }),

  // Invalidate view counts for content
  viewCounts: () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.content.all(),
    }),

  // Invalidate comments for a target
  comments: (targetType: "album" | "media", targetId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.comments.byTarget(targetType, targetId),
    }),

  // Invalidate admin data
  admin: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all() }),

  // Invalidate admin profile
  adminProfile: () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.profile() }),
};

// Cache update utilities for optimistic updates
export const updateCache = {
  // Update user interaction status optimistically
  userInteractionStatus: (
    targetType: "album" | "media" | "comment",
    targetId: string,
    updates: { userLiked?: boolean; userBookmarked?: boolean }
  ) => {
    const targets = [{ targetType, targetId }];
    const queryKey = queryKeys.user.interactions.status(targets);

    queryClient.setQueryData(
      queryKey,
      (oldData: InteractionStatusResponse | undefined) => {
        // If there's no existing data, create the structure with the optimistic update
        if (!oldData?.statuses) {
          return {
            statuses: [
              {
                targetType,
                targetId,
                userLiked: updates.userLiked ?? false,
                userBookmarked: updates.userBookmarked ?? false,
                likeCount: updates.userLiked ? 1 : 0,
                bookmarkCount: updates.userBookmarked ? 1 : 0,
              },
            ],
          };
        }

        return {
          ...oldData,
          statuses: oldData?.statuses.map((status) => {
            if (
              status.targetType === targetType &&
              status.targetId === targetId
            ) {
              return {
                ...status,
                ...updates,
              };
            }
            return status;
          }),
        };
      }
    );
  },

  // Update album in lists after creation/update
  albumInLists: (
    album: Partial<Album> & { id: string },
    action: "add" | "update" | "remove"
  ) => {
    queryClient.setQueriesData(
      { queryKey: queryKeys.albums.lists() },
      (oldData: AlbumsListData | undefined) => {
        if (!oldData?.albums) return oldData;

        switch (action) {
          case "add":
            return {
              ...oldData,
              albums: [album as Album, ...oldData.albums],
            };
          case "update":
            return {
              ...oldData,
              albums: oldData.albums.map((existingAlbum) =>
                existingAlbum.id === album.id
                  ? { ...existingAlbum, ...album }
                  : existingAlbum
              ),
            };
          case "remove":
            return {
              ...oldData,
              albums: oldData.albums.filter(
                (existingAlbum) => existingAlbum.id !== album.id
              ),
            };
          default:
            return oldData;
        }
      }
    );
  },

  // Update interaction counts optimistically (for detail pages and album lists)
  interactionCounts: (
    targetType: "album" | "media" | "comment",
    targetId: string,
    type: "like" | "bookmark",
    increment: number
  ) => {
    // For comments, only update the interaction status cache
    if (targetType === "comment") {
      //   const targets = [{ targetType, targetId }];
      //   const statusQueryKey = queryKeys.user.interactions.status(targets);
      //   queryClient.setQueryData(
      //     statusQueryKey,
      //     (oldData: InteractionStatusResponse | undefined) => {
      //       const countField = type === "like" ? "likeCount" : "bookmarkCount";
      //       // If there's no existing data, create it with the count update
      //       if (!oldData?.statuses) {
      //         return {
      //           statuses: [
      //             {
      //               targetType,
      //               targetId,
      //               userLiked: false,
      //               userBookmarked: false,
      //               likeCount: type === "like" ? Math.max(0, increment) : 0,
      //               bookmarkCount:
      //                 type === "bookmark" ? Math.max(0, increment) : 0,
      //             },
      //           ],
      //         };
      //       }
      //       return {
      //         ...oldData,
      //         statuses: oldData.statuses.map((status) => {
      //           if (
      //             status.targetType === targetType &&
      //             status.targetId === targetId
      //           ) {
      //             return {
      //               ...status,
      //               [countField]: Math.max(
      //                 0,
      //                 (status[countField] || 0) + increment
      //               ),
      //             };
      //           }
      //           return status;
      //         }),
      //       };
      //     }
      //   );
      //   return;
    } else {
      // Update in album/media detail pages
      const detailQueryKey =
        targetType === "album"
          ? queryKeys.albums.detail(targetId)
          : queryKeys.media.detail(targetId);

      queryClient.setQueryData(
        detailQueryKey,
        (oldData: Album | Media | undefined) => {
          if (!oldData) return oldData;

          const countField = type === "like" ? "likeCount" : "bookmarkCount";
          return {
            ...oldData,
            [countField]: Math.max(0, (oldData[countField] || 0) + increment),
          };
        }
      );

      // Also update in any album lists that might contain this item
      queryClient.setQueriesData(
        { queryKey: queryKeys.albums.lists() },
        (oldData: AlbumsListData | undefined) => {
          if (!oldData?.albums) return oldData;

          return {
            ...oldData,
            albums: oldData.albums.map((album) => {
              if (album.id === targetId) {
                const countField =
                  type === "like" ? "likeCount" : "bookmarkCount";
                return {
                  ...album,
                  [countField]: Math.max(
                    0,
                    (album[countField] || 0) + increment
                  ),
                };
              }
              return album;
            }),
          };
        }
      );
    }
  },
};
