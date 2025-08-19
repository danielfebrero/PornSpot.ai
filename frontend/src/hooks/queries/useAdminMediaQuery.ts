import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { adminMediaApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";
import type { Media, UnifiedPaginationMeta, UploadMediaRequest } from "@/types";

// Types for admin media operations - using shared types
type UploadMediaData = UploadMediaRequest;

interface AdminMediaResponse {
  media: Media[];
  pagination: UnifiedPaginationMeta;
}

interface InfiniteAdminMediaData {
  pages: AdminMediaResponse[];
  pageParams: unknown[];
}

// Hook for fetching all media with infinite scroll (admin view)
export function useAdminMediaQuery(params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.admin.media.all(),
    queryFn: async ({ pageParam }): Promise<AdminMediaResponse> => {
      return await adminMediaApi.getMediaList({
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    // Keep admin media fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for admin data
    refetchOnWindowFocus: true,
  });
}

// Helper function to extract all media from infinite query
export function useAdminMediaData(params: { limit?: number } = {}) {
  const query = useAdminMediaQuery(params);

  const media = query.data?.pages.flatMap((page) => page.media) ?? [];

  return {
    media,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}

// Hook for fetching album media (admin view)
// This reuses the existing album media API but with admin-specific query keys
export function useAdminAlbumMedia(
  albumId: string,
  params: { limit?: number } = {}
) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.admin.media.album(albumId, { limit }),
    queryFn: async ({ pageParam }): Promise<AdminMediaResponse> => {
      return await adminMediaApi.getAlbumMedia(albumId, {
        limit,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.cursor
        : undefined;
    },
    enabled: !!albumId,
    // Keep admin media fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for admin data
    refetchOnWindowFocus: true,
  });
}

// Hook for admin media operations like batch actions
export function useAdminMediaList(albumIds: string[] = []) {
  return useQuery({
    queryKey: queryKeys.admin.media.list(albumIds),
    queryFn: async () => {
      // Fetch media for multiple albums for admin overview
      if (albumIds.length === 0) return { media: [] };

      const promises = albumIds.map((albumId) =>
        adminMediaApi.getAlbumMedia(albumId, { limit: 100 })
      );

      const results = await Promise.all(promises);
      const allMedia = results.flatMap((result) => result.media);

      return { media: allMedia };
    },
    enabled: albumIds.length > 0,
    // Keep admin media list fresh for 2 minutes
    staleTime: 2 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
  });
}

// Mutation hook for admin media upload
export function useAdminUploadMedia() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaData,
    }: {
      albumId: string;
      mediaData: UploadMediaData;
    }) => {
      return await adminMediaApi.uploadMedia(albumId, mediaData);
    },
    onSuccess: (data, variables) => {
      // Invalidate admin album media queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.media.album(variables.albumId),
      });

      // Invalidate global admin media queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Invalidate regular media queries
      queryClient.invalidateQueries({
        queryKey: ["media", "album", variables.albumId],
      });

      // Invalidate the specific album
      invalidateQueries.album(variables.albumId);
    },
  });
}

// Mutation hook for admin media deletion
export function useAdminDeleteMedia() {
  return useMutation({
    mutationFn: async (mediaId: string) => {
      return await adminMediaApi.deleteMedia(mediaId);
    },
    onMutate: async (mediaId) => {
      // Cancel any outgoing refetches for admin media queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Cancel any outgoing refetches for album media queries
      await queryClient.cancelQueries({
        queryKey: ["media", "album"],
        predicate: (query) => {
          return query.queryKey[0] === "media" && query.queryKey[1] === "album";
        },
      });

      // Snapshot the previous values
      const previousMedia = queryClient.getQueriesData({
        queryKey: queryKeys.admin.media.all(),
      });

      // Snapshot the previous album media values
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album"],
        predicate: (query) => {
          return query.queryKey[0] === "media" && query.queryKey[1] === "album";
        },
      });

      // Optimistically remove the media from all admin media queries
      queryClient.setQueriesData(
        { queryKey: queryKeys.admin.media.all() },
        (old: InfiniteAdminMediaData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            media: page.media.filter((m: Media) => m.id !== mediaId),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Optimistically remove the media from all album media queries
      queryClient.setQueriesData(
        {
          queryKey: ["media", "album"],
          predicate: (query) => {
            return query.queryKey[0] === "media" && query.queryKey[1] === "album";
          },
        },
        (old: any) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page: any) => ({
            ...page,
            media: page.media.filter((m: Media) => m.id !== mediaId),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Return context for rollback
      return { previousMedia, previousAlbumMedia, mediaId };
    },
    onError: (err, mediaId, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousMedia) {
        context.previousMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      // Restore previous album media data
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data, mediaId) => {
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: queryKeys.media.detail(mediaId),
      });

      // Invalidate related queries
      invalidateQueries.media(mediaId);

      // Invalidate admin-specific queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Invalidate all album media queries
      queryClient.invalidateQueries({
        queryKey: ["media", "album"],
        predicate: (query) => {
          return query.queryKey[0] === "media" && query.queryKey[1] === "album";
        },
      });

      // Invalidate all albums that might contain this media
      queryClient.invalidateQueries({
        queryKey: queryKeys.albums.lists(),
      });
    },
  });
}

// Mutation hook for batch operations (admin)
export function useAdminBatchDeleteMedia() {
  return useMutation({
    mutationFn: async (mediaIds: string[]) => {
      // Execute deletions in parallel
      return await Promise.all(
        mediaIds.map((mediaId) => adminMediaApi.deleteMedia(mediaId))
      );
    },
    onMutate: async (mediaIds) => {
      // Cancel global admin media queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Cancel any outgoing refetches for album media queries
      await queryClient.cancelQueries({
        queryKey: ["media", "album"],
        predicate: (query) => {
          return query.queryKey[0] === "media" && query.queryKey[1] === "album";
        },
      });

      // Snapshot previous values
      const previousData = queryClient.getQueriesData({
        queryKey: queryKeys.admin.media.all(),
      });

      // Snapshot the previous album media values
      const previousAlbumMediaData = queryClient.getQueriesData({
        queryKey: ["media", "album"],
        predicate: (query) => {
          return query.queryKey[0] === "media" && query.queryKey[1] === "album";
        },
      });

      // Optimistically remove all media from admin media queries
      queryClient.setQueriesData(
        { queryKey: queryKeys.admin.media.all() },
        (old: InfiniteAdminMediaData | undefined) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page) => ({
            ...page,
            media: page.media.filter((m: Media) => !mediaIds.includes(m.id)),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      // Optimistically remove all media from album media queries
      queryClient.setQueriesData(
        {
          queryKey: ["media", "album"],
          predicate: (query) => {
            return query.queryKey[0] === "media" && query.queryKey[1] === "album";
          },
        },
        (old: any) => {
          if (!old?.pages) return old;

          const newPages = old.pages.map((page: any) => ({
            ...page,
            media: page.media.filter((m: Media) => !mediaIds.includes(m.id)),
          }));

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      return { previousData, previousAlbumMediaData, mediaIds };
    },
    onError: (err, mediaIds, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      // Restore previous album media data
      if (context?.previousAlbumMediaData) {
        context.previousAlbumMediaData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data, mediaIds) => {
      // Remove all deleted media from cache
      mediaIds.forEach((mediaId) => {
        queryClient.removeQueries({
          queryKey: queryKeys.media.detail(mediaId),
        });
        invalidateQueries.media(mediaId);
      });

      // Invalidate all admin media queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.media.all(),
      });

      // Invalidate all album media queries
      queryClient.invalidateQueries({
        queryKey: ["media", "album"],
        predicate: (query) => {
          return query.queryKey[0] === "media" && query.queryKey[1] === "album";
        },
      });

      // Invalidate all albums that might contain these media
      queryClient.invalidateQueries({
        queryKey: queryKeys.albums.lists(),
      });
    },
  });
}
