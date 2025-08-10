import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { mediaApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";
import { UnifiedMediaResponse, Media } from "@/types";

// Types for infinite query data structure
interface InfiniteMediaQueryData {
  pages: MediaResponse[];
  pageParams: unknown[];
}

// Types
interface UploadMediaData {
  filename: string;
  mimeType: string;
  size: number;
}

interface MediaQueryParams {
  limit?: number;
  cursor?: string;
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
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: ["media", "user", params],
    queryFn: async ({ pageParam }) => {
      return await mediaApi.getUserMedia({
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

// Mutation hook for adding existing media to an album
export function useAddMediaToAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaId,
    }: {
      albumId: string;
      mediaId: string;
    }) => {
      // Import albums API dynamically to avoid circular dependencies
      const { albumsApi } = await import("@/lib/api");
      await albumsApi.addMediaToAlbum(albumId, mediaId);
      return { albumId, mediaId };
    },
    onMutate: async ({ albumId, mediaId }) => {
      // Cancel any outgoing refetches for album media
      await queryClient.cancelQueries({
        queryKey: ["media", "album", albumId],
      });

      // Snapshot the previous values
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album", albumId],
      });

      // Get the media item to add (if it exists in cache)
      const mediaItem = queryClient.getQueryData(
        queryKeys.media.detail(mediaId)
      );

      // Optimistically add the media to album media infinite query
      if (mediaItem) {
        queryClient.setQueriesData(
          { queryKey: ["media", "album", albumId] },
          (old: InfiniteMediaQueryData | undefined) => {
            if (!old?.pages) return old;

            // Add to first page to show it immediately
            const newPages = [...old.pages];
            if (newPages[0]?.media) {
              newPages[0] = {
                ...newPages[0],
                media: [mediaItem as Media, ...newPages[0].media],
              };
            }

            return {
              ...old,
              pages: newPages,
            };
          }
        );
      }

      // Return context for rollback
      return { previousAlbumMedia, albumId, mediaId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error("Failed to add media to album:", err);
    },
    onSuccess: (data, variables) => {
      // Invalidate album media queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["media", "album", variables.albumId],
      });

      // Invalidate user media queries in case media appears there
      queryClient.invalidateQueries({
        queryKey: ["media", "user"],
      });

      // Invalidate the specific album to update counts
      invalidateQueries.album(variables.albumId);

      // Invalidate the specific media item
      invalidateQueries.media(variables.mediaId);
    },
    onSettled: (data, error, variables) => {
      // Final cleanup - ensure we have fresh data
      queryClient.invalidateQueries({
        queryKey: ["media", "album", variables.albumId],
      });
    },
  });
}

// Mutation hook for bulk adding existing media to an album
export function useBulkAddMediaToAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaIds,
    }: {
      albumId: string;
      mediaIds: string[];
    }) => {
      // Import albums API dynamically to avoid circular dependencies
      const { albumsApi } = await import("@/lib/api");
      const results = await albumsApi.bulkAddMediaToAlbum(albumId, mediaIds);
      return { albumId, mediaIds, results };
    },
    onMutate: async ({ albumId, mediaIds }) => {
      // Cancel any outgoing refetches for album media
      await queryClient.cancelQueries({
        queryKey: ["media", "album", albumId],
      });

      // Snapshot the previous values
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album", albumId],
      });

      // Get all media items to add (if they exist in cache)
      const mediaItems = mediaIds
        .map((mediaId) =>
          queryClient.getQueryData(queryKeys.media.detail(mediaId))
        )
        .filter(Boolean);

      // Optimistically add the media to album media infinite query
      if (mediaItems.length > 0) {
        queryClient.setQueriesData(
          { queryKey: ["media", "album", albumId] },
          (old: InfiniteMediaQueryData | undefined) => {
            if (!old?.pages) return old;

            // Add to first page to show immediately
            const newPages = [...old.pages];
            if (newPages[0]?.media) {
              newPages[0] = {
                ...newPages[0],
                media: [...mediaItems as Media[], ...newPages[0].media],
              };
            }

            return {
              ...old,
              pages: newPages,
            };
          }
        );
      }

      // Return context for rollback
      return { previousAlbumMedia, albumId, mediaIds };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error("Failed to bulk add media to album:", err);
    },
    onSuccess: (data, variables) => {
      // Invalidate album media queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["media", "album", variables.albumId],
      });

      // Invalidate user media queries in case media appears there
      queryClient.invalidateQueries({
        queryKey: ["media", "user"],
      });

      // Invalidate the specific album to update counts
      invalidateQueries.album(variables.albumId);

      // Invalidate each successfully added media item
      if (data.results.successfullyAdded.length > 0) {
        data.results.successfullyAdded.forEach((mediaId) => {
          invalidateQueries.media(mediaId);
        });
      }
    },
  });
}

// Mutation hook for removing media from an album
export function useRemoveMediaFromAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaId,
    }: {
      albumId: string;
      mediaId: string;
    }) => {
      // Import albums API dynamically to avoid circular dependencies
      const { albumsApi } = await import("@/lib/api");
      await albumsApi.removeMediaFromAlbum(albumId, mediaId);
      return { albumId, mediaId };
    },
    onMutate: async ({ albumId, mediaId }) => {
      // Cancel any outgoing refetches for album media
      await queryClient.cancelQueries({
        queryKey: ["media", "album", albumId],
      });

      // Snapshot the previous values
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album", albumId],
      });

      // Optimistically remove the media from album media infinite query
      queryClient.setQueriesData(
        { queryKey: ["media", "album", albumId] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              media: page.data.media.filter((m) => m.id !== mediaId),
            },
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Return context for rollback
      return { previousAlbumMedia, albumId, mediaId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error("Failed to remove media from album:", err);
    },
    onSuccess: (data, variables) => {
      // No need to invalidate album media queries - optimistic update handles this

      // Invalidate user media queries in case media appears there
      queryClient.invalidateQueries({
        queryKey: ["media", "user"],
      });

      // Invalidate the specific album to update counts (but not media list)
      invalidateQueries.album(variables.albumId);

      // Invalidate the specific media item
      invalidateQueries.media(variables.mediaId);
    },
  });
}

// Mutation hook for bulk removing media from an album
export function useBulkRemoveMediaFromAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaIds,
    }: {
      albumId: string;
      mediaIds: string[];
    }) => {
      // Import albums API dynamically to avoid circular dependencies
      const { albumsApi } = await import("@/lib/api");
      const results = await albumsApi.bulkRemoveMediaFromAlbum(
        albumId,
        mediaIds
      );
      return { albumId, mediaIds, results };
    },
    onMutate: async ({ albumId, mediaIds }) => {
      // Cancel any outgoing refetches for album media
      await queryClient.cancelQueries({
        queryKey: ["media", "album", albumId],
      });

      // Snapshot the previous values
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album", albumId],
      });

      // Optimistically remove the media from album media infinite query
      queryClient.setQueriesData(
        { queryKey: ["media", "album", albumId] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              media: page.data.media.filter(
                (m) => !mediaIds.includes(m.id)
              ),
            },
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Return context for rollback
      return { previousAlbumMedia, albumId, mediaIds };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error("Failed to bulk remove media from album:", err);
    },
    onSuccess: (data, variables) => {
      // No need to invalidate album media queries - optimistic update handles this

      // Invalidate user media queries in case media appears there
      queryClient.invalidateQueries({
        queryKey: ["media", "user"],
      });

      // Invalidate the specific album to update counts (but not media list)
      invalidateQueries.album(variables.albumId);

      // Invalidate each successfully removed media item
      if (data.results.successfullyRemoved.length > 0) {
        data.results.successfullyRemoved.forEach((mediaId) => {
          invalidateQueries.media(mediaId);
        });
      }
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

      // Snapshot the previous values for rollback
      const previousMedia = queryClient.getQueryData(
        queryKeys.media.detail(mediaId)
      );

      // Get all album media queries to update them optimistically
      const albumMediaQueries = queryClient.getQueriesData({
        queryKey: ["media", "album"],
      });

      // Optimistically remove the media from all album media infinite queries
      albumMediaQueries.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData(queryKey, (old: InfiniteMediaQueryData | undefined) => {
            if (!old?.pages) return old;

            const newPages = old.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                media: page.data.media.filter((m) => m.id !== mediaId),
              },
            }));

            return {
              ...old,
              pages: newPages,
            };
          });
        }
      });

      // Optimistically remove from user media infinite queries
      queryClient.setQueriesData(
        { queryKey: ["media", "user"] },
        (old: InfiniteMediaQueryData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              media: page.data.media.filter((m) => m.id !== mediaId),
            },
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
      return { previousMedia, mediaId, albumMediaQueries };
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

      // Invalidate to refetch correct data
      invalidateQueries.media(mediaId);
      queryClient.invalidateQueries({ queryKey: ["media", "user"] });
      queryClient.invalidateQueries({ queryKey: ["media", "album"] });

      console.error("Failed to delete media:", err);
    },
    onSuccess: (data, mediaId) => {
      // No need to invalidate album/user media queries - optimistic update handles this

      // Invalidate all album queries since media counts have changed
      queryClient.invalidateQueries({
        queryKey: ["albums"],
      });

      // Invalidate user profile query since media counts may have changed
      invalidateQueries.user();

      console.log("✅ Media deleted successfully:", mediaId);
    },
  });
}
