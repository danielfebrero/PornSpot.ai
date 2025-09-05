import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { mediaApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";
import {
  UnifiedMediaResponse,
  Media,
  UploadMediaRequest,
  InfiniteMediaQueryData,
} from "@/types";

// Types for infinite query data structure

// Types - using shared types
type UploadMediaData = UploadMediaRequest;

interface MediaQueryParams {
  limit?: number;
  cursor?: string;
  username?: string;
}

interface AlbumMediaQueryParams {
  albumId: string;
  limit?: number;
  cursor?: string;
}

// Use the new unified response type
type MediaResponse = UnifiedMediaResponse;

// Hook for fetching user's media with infinite scroll support
export function useUserMedia(params: MediaQueryParams = {}) {
  const { limit = 20, username } = params;

  return useInfiniteQuery({
    queryKey: ["media", "user", { limit, username }],
    queryFn: async ({ pageParam }) => {
      return await mediaApi.getUserMedia({
        limit,
        cursor: pageParam,
        username,
      });
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: MediaResponse) => {
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    // Keep media fresh for 2 minutes
    staleTime: 2 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
  });
}

// Hook for fetching album media with infinite scroll support
export function useAlbumMedia(params: AlbumMediaQueryParams) {
  const { albumId, limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: ["media", "album", albumId, { limit }],
    queryFn: async ({ pageParam }) => {
      return await mediaApi.getAlbumMedia(albumId, {
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage: MediaResponse) => {
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: !!albumId,
    // Keep album media fresh for 2 minutes
    staleTime: 2 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
  });
}

// Hook for fetching single media item by ID
export function useMediaById(mediaId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.media.detail(mediaId),
    queryFn: async () => {
      return await mediaApi.getMediaById(mediaId);
    },
    enabled: !!mediaId && enabled,
    // Keep media details fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Enable background refetching for media details
    refetchOnWindowFocus: true,
  });
}

// Mutation hook for uploading media to an album
export function useUploadMedia() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaData,
    }: {
      albumId: string;
      mediaData: UploadMediaData;
    }) => {
      return await mediaApi.uploadMedia(albumId, mediaData);
    },
    onSuccess: (data, variables) => {
      // Invalidate album media queries
      queryClient.invalidateQueries({
        queryKey: ["media", "album", variables.albumId],
      });

      // Invalidate user media queries
      queryClient.invalidateQueries({
        queryKey: ["media", "user"],
      });

      // Invalidate the specific album
      invalidateQueries.album(variables.albumId);
    },
  });
}

// Mutation hook for deleting media
export function useDeleteMedia() {
  return useMutation({
    mutationFn: async (mediaId: string) => {
      return await mediaApi.deleteMedia(mediaId);
    },
    onMutate: async (mediaId) => {
      // Cancel any outgoing refetches for this media
      await queryClient.cancelQueries({
        queryKey: queryKeys.media.detail(mediaId),
      });

      // Cancel any outgoing refetches for admin media queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Snapshot the previous values for rollback
      const previousMedia = queryClient.getQueryData(
        queryKeys.media.detail(mediaId)
      );

      // Get all album media queries to update them optimistically
      const albumMediaQueries = queryClient.getQueriesData({
        queryKey: ["media", "album"],
      });

      // Snapshot the previous admin media values for rollback
      const previousAdminMedia = queryClient.getQueriesData({
        queryKey: queryKeys.admin.media.all(),
      });

      // Optimistically remove the media from all album media infinite queries
      albumMediaQueries.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(
            queryKey,
            (old: InfiniteMediaQueryData | undefined) => {
              if (!old?.pages) return old;

              const newPages = old.pages.map((page) => ({
                ...page,
                media: page.media.filter((m) => m.id !== mediaId),
              }));

              return {
                ...old,
                pages: newPages,
              };
            }
          );
        }
      });

      // Optimistically remove from user media infinite queries
      queryClient.setQueriesData(
        { queryKey: ["media", "user"] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            media: page.media.filter((m) => m.id !== mediaId),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Optimistically remove the media from all admin media queries
      queryClient.setQueriesData(
        { queryKey: queryKeys.admin.media.all() },
        (old: any) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page: any) => ({
            ...page,
            media: page.media.filter((m: any) => m.id !== mediaId),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: queryKeys.media.detail(mediaId) });

      // Return context for rollback
      return { previousMedia, mediaId, albumMediaQueries, previousAdminMedia };
    },
    onError: (err, mediaId, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousMedia) {
        queryClient.setQueryData(
          queryKeys.media.detail(mediaId),
          context.previousMedia
        );
      }

      // Restore album media queries
      if (context?.albumMediaQueries) {
        context.albumMediaQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Restore admin media queries
      if (context?.previousAdminMedia) {
        context.previousAdminMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Invalidate to refetch correct data
      invalidateQueries.media(mediaId);
      queryClient.invalidateQueries({ queryKey: ["media", "user"] });
      queryClient.invalidateQueries({ queryKey: ["media", "album"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.media.all() });

      console.error("Failed to delete media:", err);
    },
    onSuccess: (data, mediaId) => {
      // No need to invalidate album/user media queries - optimistic update handles this

      // Invalidate all album queries since media counts have changed
      queryClient.invalidateQueries({
        queryKey: ["albums"],
      });

      // Invalidate admin media queries to ensure counts and data are fresh
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Invalidate user profile query since media counts may have changed
      invalidateQueries.user();
    },
  });
}

// Mutation hook for bulk deleting media
export function useBulkDeleteMedia() {
  return useMutation({
    mutationFn: async (mediaIds: string[]) => {
      return await mediaApi.bulkDeleteMedia(mediaIds);
    },
    onMutate: async (mediaIds) => {
      // Cancel any outgoing refetches for these media
      for (const mediaId of mediaIds) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.media.detail(mediaId),
        });
      }

      // Cancel any outgoing refetches for admin media queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Snapshot the previous values for rollback
      const previousMediaDetails: Record<string, any> = {};
      for (const mediaId of mediaIds) {
        previousMediaDetails[mediaId] = queryClient.getQueryData(
          queryKeys.media.detail(mediaId)
        );
      }

      // Get all album media queries to update them optimistically
      const albumMediaQueries = queryClient.getQueriesData({
        queryKey: ["media", "album"],
      });

      // Snapshot the previous admin media values for rollback
      const previousAdminMedia = queryClient.getQueriesData({
        queryKey: queryKeys.admin.media.all(),
      });

      // Snapshot the previous user media values for rollback
      const previousUserMedia = queryClient.getQueriesData({
        queryKey: ["media", "user"],
      });

      // Optimistically remove the media from all album media infinite queries
      albumMediaQueries.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(
            queryKey,
            (old: InfiniteMediaQueryData | undefined) => {
              if (!old?.pages) return old;

              const newPages = old.pages.map((page) => ({
                ...page,
                media: page.media.filter((m) => !mediaIds.includes(m.id)),
              }));

              return {
                ...old,
                pages: newPages,
              };
            }
          );
        }
      });

      // Optimistically remove from user media infinite queries
      queryClient.setQueriesData(
        { queryKey: ["media", "user"] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            media: page.media.filter((m) => !mediaIds.includes(m.id)),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Optimistically remove the media from all admin media queries
      queryClient.setQueriesData(
        { queryKey: queryKeys.admin.media.all() },
        (old: any) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page: any) => ({
            ...page,
            media: page.media.filter((m: any) => !mediaIds.includes(m.id)),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Remove from detail cache
      for (const mediaId of mediaIds) {
        queryClient.removeQueries({
          queryKey: queryKeys.media.detail(mediaId),
        });
      }

      // Return context for rollback
      return {
        previousMediaDetails,
        mediaIds,
        albumMediaQueries,
        previousAdminMedia,
        previousUserMedia,
      };
    },
    onError: (err, mediaIds, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousMediaDetails) {
        for (const mediaId of mediaIds) {
          const previousData = context.previousMediaDetails[mediaId];
          if (previousData) {
            queryClient.setQueryData(
              queryKeys.media.detail(mediaId),
              previousData
            );
          }
        }
      }

      // Restore album media queries
      if (context?.albumMediaQueries) {
        context.albumMediaQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Restore admin media queries
      if (context?.previousAdminMedia) {
        context.previousAdminMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Restore user media queries
      if (context?.previousUserMedia) {
        context.previousUserMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Invalidate to refetch correct data
      for (const mediaId of mediaIds) {
        invalidateQueries.media(mediaId);
      }
      queryClient.invalidateQueries({ queryKey: ["media", "user"] });
      queryClient.invalidateQueries({ queryKey: ["media", "album"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.media.all() });

      console.error("Failed to bulk delete media:", err);
    },
    onSuccess: (data) => {
      // Check for any failed deletions and invalidate those specific media
      const failedMediaIds = data.results
        .filter((result) => !result.success)
        .map((result) => result.mediaId);

      // For failed deletions, invalidate the specific media to refetch correct data
      for (const failedMediaId of failedMediaIds) {
        invalidateQueries.media(failedMediaId);
      }

      // If there were failures, also invalidate all queries to ensure consistency
      if (failedMediaIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["media", "user"] });
        queryClient.invalidateQueries({ queryKey: ["media", "album"] });
      }

      // Invalidate all album queries since media counts have changed
      queryClient.invalidateQueries({
        queryKey: ["albums"],
      });

      // Invalidate admin media queries to ensure counts and data are fresh
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Invalidate user profile query since media counts may have changed
      invalidateQueries.user();

      if (data.summary.failed > 0) {
        console.warn(
          "Some media failed to delete:",
          data.results.filter((r) => !r.success)
        );
      }
    },
  });
}

// Mutation hook for updating media properties
export function useUpdateMedia() {
  return useMutation({
    mutationFn: async ({
      mediaId,
      updates,
    }: {
      mediaId: string;
      updates: Partial<{
        title: string;
        isPublic: boolean;
      }>;
    }) => {
      return await mediaApi.updateMedia(mediaId, updates);
    },
    onMutate: async ({ mediaId, updates }) => {
      // Cancel any outgoing refetches for this media
      await queryClient.cancelQueries({
        queryKey: queryKeys.media.detail(mediaId),
      });

      // Cancel any outgoing refetches for user media queries
      await queryClient.cancelQueries({
        queryKey: ["media", "user"],
      });

      // Cancel any outgoing refetches for album media queries
      await queryClient.cancelQueries({
        queryKey: ["media", "album"],
      });

      // Snapshot the previous values for rollback
      const previousMedia = queryClient.getQueryData(
        queryKeys.media.detail(mediaId)
      );

      // Snapshot the previous user media values for rollback
      const previousUserMedia = queryClient.getQueriesData({
        queryKey: ["media", "user"],
      });

      // Snapshot the previous album media values for rollback
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album"],
      });

      // Optimistically update the media in the detail cache
      queryClient.setQueryData(
        queryKeys.media.detail(mediaId),
        (old: Media | undefined) => {
          if (!old) return old;
          return {
            ...old,
            filename: updates.title ?? old.filename,
            isPublic: updates.isPublic ?? old.isPublic,
            updatedAt: new Date().toISOString(),
          };
        }
      );

      // Optimistically update the media in user media infinite queries
      queryClient.setQueriesData(
        { queryKey: ["media", "user"] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            media: page.media.map((media) =>
              media.id === mediaId
                ? {
                    ...media,
                    filename: updates.title ?? media.filename,
                    isPublic: updates.isPublic ?? media.isPublic,
                    updatedAt: new Date().toISOString(),
                  }
                : media
            ),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Optimistically update the media in album media infinite queries
      queryClient.setQueriesData(
        { queryKey: ["media", "album"] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            media: page.media.map((media) =>
              media.id === mediaId
                ? {
                    ...media,
                    filename: updates.title ?? media.filename,
                    isPublic: updates.isPublic ?? media.isPublic,
                    updatedAt: new Date().toISOString(),
                  }
                : media
            ),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      return {
        previousMedia,
        previousUserMedia,
        previousAlbumMedia,
      };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMedia) {
        queryClient.setQueryData(
          queryKeys.media.detail(variables.mediaId),
          context.previousMedia
        );
      }

      // Restore user media queries
      if (context?.previousUserMedia) {
        context.previousUserMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Restore album media queries
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      console.error("Failed to update media:", err);
    },
    onSuccess: (data, variables) => {
      // Update the cache with the server response
      queryClient.setQueryData(queryKeys.media.detail(variables.mediaId), data);

      // No need to invalidate user media and album media queries
      // since optimistic updates already handle the changes
    },
  });
}

// Mutation hook for downloading media as zip
export function useDownloadMediaZip() {
  return useMutation({
    mutationFn: async (mediaIds: string[]) => {
      return await mediaApi.downloadZip(mediaIds);
    },
    onError: (error: Error) => {
      console.error("Failed to download media zip:", error);
      throw error;
    },
  });
}
