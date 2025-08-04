import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { albumsApi } from "@/lib/api";
import {
  queryKeys,
  queryClient,
  updateCache,
  invalidateQueries,
} from "@/lib/queryClient";
import { Album } from "@/types";

// Types
interface CreateAlbumData {
  title: string;
  tags?: string[];
  isPublic: boolean;
  mediaIds?: string[];
  coverImageId?: string;
}

interface UpdateAlbumData {
  title?: string;
  tags?: string[];
  isPublic?: boolean;
  coverImageUrl?: string;
}

interface AlbumsQueryParams {
  user?: string;
  isPublic?: boolean;
  limit?: number;
  tag?: string;
  // SSG/ISR support
  initialData?: {
    albums: Album[];
    pagination?: {
      hasNext: boolean;
      cursor: string | null;
    };
  };
}

interface AlbumsResponse {
  success: boolean;
  data?: {
    albums: Album[];
    pagination: {
      hasNext: boolean;
      cursor?: string;
    };
  };
  error?: string;
}

// Hook for fetching albums list with infinite scroll support
export function useAlbums(params: AlbumsQueryParams = {}) {
  const { limit = 12, initialData, ...restParams } = params;

  // Transform initial data for TanStack Query if provided
  const transformedInitialData = initialData
    ? {
        pages: [
          {
            success: true,
            data: {
              albums: initialData.albums,
              pagination: {
                hasNext: initialData.pagination?.hasNext || false,
                cursor: initialData.pagination?.cursor || undefined,
              },
            },
          },
        ],
        pageParams: [undefined as string | undefined],
      }
    : undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.albums.list(restParams), // Exclude initialData from query key
    queryFn: async ({ pageParam }): Promise<AlbumsResponse> => {
      return await albumsApi.getAlbums({
        ...restParams,
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    // Use initial data from SSG/ISR if provided
    initialData: transformedInitialData,
    getNextPageParam: (lastPage: AlbumsResponse) => {
      return lastPage.data?.pagination?.hasNext ? lastPage.data.pagination.cursor : undefined;
    },
    getPreviousPageParam: () => undefined, // We don't support backward pagination
    // Fresh data for 30 seconds, then stale-while-revalidate
    staleTime: 30 * 1000,
    // Enable background refetching for public albums
    refetchOnWindowFocus: restParams.isPublic === true,
    // More aggressive refetching for user's own albums
    refetchInterval: !restParams.user ? 60 * 1000 : false, // 1 minute for own albums
  });
}

// Hook for fetching a single album
export function useAlbum(albumId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.albums.detail(albumId),
    queryFn: async () => await albumsApi.getAlbum(albumId),
    enabled: !!albumId && options?.enabled !== false,
    // Keep album data fresh for 2 minutes
    staleTime: 2 * 60 * 1000,
    // Enable refetch on window focus for album details
    refetchOnWindowFocus: true,
  });
}

// Hook for fetching album media with infinite scroll
export function useAlbumMedia(
  albumId: string,
  params: { limit?: number } = {},
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: queryKeys.albums.media(albumId, params),
    queryFn: async ({ pageParam }) => {
      // Note: This would require implementing getAlbumMedia in albumsApi
      // For now, we'll return mock data structure
      return {
        media: [],
        nextCursor: pageParam,
        hasNext: false,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => {
      return lastPage.hasNext ? lastPage.nextCursor : undefined;
    },
    enabled: !!albumId && options?.enabled !== false,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Mutation for creating albums
export function useCreateAlbum() {
  return useMutation({
    mutationFn: async (data: CreateAlbumData) => {
      return await albumsApi.createAlbum(data);
    },
    onSuccess: (newAlbum) => {
      // Optimistically update the cache
      updateCache.albumInLists(newAlbum, "add");

      // Invalidate albums lists to ensure fresh data
      invalidateQueries.albumsLists();

      // If this is the user's own album, invalidate their profile
      invalidateQueries.user();
    },
    onError: (error) => {
      console.error("Failed to create album:", error);
      // Revert optimistic update if needed
      invalidateQueries.albumsLists();
    },
  });
}

// Mutation for updating albums
export function useUpdateAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      data,
    }: {
      albumId: string;
      data: UpdateAlbumData;
    }) => {
      return await albumsApi.updateAlbum(albumId, data);
    },
    onMutate: async ({ albumId, data }) => {
      // Cancel outgoing refetches (so they don't overwrite optimistic update)
      await queryClient.cancelQueries({
        queryKey: queryKeys.albums.detail(albumId),
      });

      // Snapshot the previous value
      const previousAlbum = queryClient.getQueryData(
        queryKeys.albums.detail(albumId)
      );

      // Optimistically update the cache
      queryClient.setQueryData(queryKeys.albums.detail(albumId), (old: any) => {
        return old ? { ...old, ...data } : old;
      });

      // Also update in lists
      updateCache.albumInLists({ id: albumId, ...data }, "update");

      // Return context with previous data for rollback
      return { previousAlbum, albumId };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousAlbum) {
        queryClient.setQueryData(
          queryKeys.albums.detail(context.albumId),
          context.previousAlbum
        );
      }
      // Invalidate to refetch correct data
      invalidateQueries.album(variables.albumId);
      invalidateQueries.albumsLists();
    },
    onSuccess: (updatedAlbum, { albumId }) => {
      // Ensure the cache is up to date with server response
      queryClient.setQueryData(queryKeys.albums.detail(albumId), updatedAlbum);
      updateCache.albumInLists(updatedAlbum, "update");
    },
  });
}

// Mutation for deleting albums
export function useDeleteAlbum() {
  return useMutation({
    mutationFn: async (albumId: string) => {
      await albumsApi.deleteAlbum(albumId);
      return albumId;
    },
    onMutate: async (albumId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.albums.detail(albumId),
      });

      // Snapshot the previous value
      const previousAlbum = queryClient.getQueryData(
        queryKeys.albums.detail(albumId)
      );

      // Optimistically remove from lists
      updateCache.albumInLists({ id: albumId }, "remove");

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: queryKeys.albums.detail(albumId) });

      return { previousAlbum, albumId };
    },
    onError: (error, albumId, context) => {
      console.error("Failed to delete album:", error);
      // Restore the album if deletion failed
      if (context?.previousAlbum) {
        queryClient.setQueryData(
          queryKeys.albums.detail(albumId),
          context.previousAlbum
        );
      }
      // Invalidate to refetch correct data
      invalidateQueries.albumsLists();
    },
    onSuccess: (albumId) => {
      // Ensure album is removed from all caches
      queryClient.removeQueries({ queryKey: queryKeys.albums.detail(albumId) });
      invalidateQueries.albumsLists();
      invalidateQueries.user();
    },
  });
}

// Mutation for adding media to album
export function useAddMediaToAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaId,
    }: {
      albumId: string;
      mediaId: string;
    }) => {
      await albumsApi.addMediaToAlbum(albumId, mediaId);
      return { albumId, mediaId };
    },
    onSuccess: ({ albumId }) => {
      // Invalidate album details and media list
      invalidateQueries.album(albumId);
      queryClient.invalidateQueries({
        queryKey: queryKeys.albums.media(albumId),
      });
    },
  });
}

// Mutation for removing media from album
export function useRemoveMediaFromAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaId,
    }: {
      albumId: string;
      mediaId: string;
    }) => {
      await albumsApi.removeMediaFromAlbum(albumId, mediaId);
      return { albumId, mediaId };
    },
    onSuccess: ({ albumId }) => {
      // Invalidate album details and media list
      invalidateQueries.album(albumId);
      queryClient.invalidateQueries({
        queryKey: queryKeys.albums.media(albumId),
      });
    },
  });
}

// Utility hook for prefetching albums
export function usePrefetchAlbum() {
  return {
    prefetch: (albumId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.albums.detail(albumId),
        queryFn: () => albumsApi.getAlbum(albumId),
        staleTime: 2 * 60 * 1000, // 2 minutes
      });
    },
  };
}
