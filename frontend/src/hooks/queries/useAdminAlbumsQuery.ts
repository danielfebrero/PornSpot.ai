import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { adminAlbumsApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";
import type { Album, UnifiedPaginationMeta } from "@/types";

// Types for admin album operations
interface CreateAdminAlbumData {
  title: string;
  description?: string;
  isPublic: boolean;
}

interface UpdateAdminAlbumData {
  title?: string;
  tags?: string[];
  isPublic?: boolean;
  coverImageUrl?: string;
}

interface AdminAlbumsResponse {
  albums: Album[];
  pagination: UnifiedPaginationMeta;
}

interface InfiniteAdminAlbumsData {
  pages: AdminAlbumsResponse[];
  pageParams: unknown[];
}

// Hook for fetching all albums with infinite scroll (admin view)
export function useAdminAlbumsQuery(params: { limit?: number } = {}) {
  const { limit = 20 } = params;

  return useInfiniteQuery({
    queryKey: queryKeys.admin.albums.all(),
    queryFn: async ({
      pageParam,
    }): Promise<AdminAlbumsResponse> => {
      return await adminAlbumsApi.getAlbums({
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
    // Keep admin albums fresh for 1 minute
    staleTime: 60 * 1000,
    // Enable background refetching for admin data
    refetchOnWindowFocus: true,
  });
}

// Helper function to extract all albums from infinite query
export function useAdminAlbumsData(params: { limit?: number } = {}) {
  const query = useAdminAlbumsQuery(params);

  // Extract albums from all pages
  const allAlbums = query.data?.pages.flatMap((page) => page.albums) || [];

  return {
    ...query,
    albums: allAlbums,
    // Provide a hasNextPage for easier access
    hasNextPage: query.hasNextPage,
    // Provide fetchNextPage for easier access
    fetchNextPage: query.fetchNextPage,
    // Provide isFetchingNextPage for loading states
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

// Hook for fetching single album (admin view)
export function useAdminAlbum(albumId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.albums.detail(albumId),
    queryFn: async () => {
      return await adminAlbumsApi.getAlbum(albumId);
    },
    enabled: !!albumId && enabled,
    // Keep album details fresh for 2 minutes
    staleTime: 2 * 60 * 1000,
    // Enable background refetching
    refetchOnWindowFocus: true,
  });
}

// Mutation hook for creating albums (admin)
export function useCreateAdminAlbum() {
  return useMutation({
    mutationFn: async (albumData: CreateAdminAlbumData) => {
      return await adminAlbumsApi.createAlbum(albumData);
    },
    onSuccess: (data) => {
      // Invalidate admin albums list to refetch with new album
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.albums.all(),
      });

      // Invalidate general albums lists
      invalidateQueries.albumsLists();

      // Set the new album in cache
      queryClient.setQueryData(queryKeys.albums.detail(data.id), data);
    },
  });
}

// Mutation hook for updating albums (admin)
export function useUpdateAdminAlbum() {
  return useMutation({
    mutationFn: async ({
      albumId,
      updates,
    }: {
      albumId: string;
      updates: UpdateAdminAlbumData;
    }) => {
      return await adminAlbumsApi.updateAlbum(albumId, updates);
    },
    onMutate: async ({ albumId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.albums.detail(albumId),
      });

      // Snapshot the previous value
      const previousAlbum = queryClient.getQueryData(
        queryKeys.albums.detail(albumId)
      );

      // Optimistically update the album
      queryClient.setQueryData(queryKeys.albums.detail(albumId), (old: Album | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      // Return context for rollback
      return { previousAlbum, albumId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to undo the optimistic update
      if (context?.previousAlbum && context?.albumId) {
        queryClient.setQueryData(
          queryKeys.albums.detail(context.albumId),
          context.previousAlbum
        );
      }
    },
    onSuccess: (data, variables) => {
      // Update the album in cache
      queryClient.setQueryData(
        queryKeys.albums.detail(variables.albumId),
        data
      );

      // Invalidate admin albums list to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.albums.all(),
      });

      // Invalidate general albums lists
      invalidateQueries.albumsLists();
    },
  });
}

// Mutation hook for deleting albums (admin)
export function useDeleteAdminAlbum() {
  return useMutation({
    mutationFn: async (albumId: string) => {
      return await adminAlbumsApi.deleteAlbum(albumId);
    },
    onMutate: async (albumId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.albums.all(),
      });

      // Snapshot the previous value
      const previousAlbums = queryClient.getQueryData(
        queryKeys.admin.albums.all()
      );

      // Optimistically remove the album from admin list
      queryClient.setQueryData(queryKeys.admin.albums.all(), (old: InfiniteAdminAlbumsData | undefined) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            albums: page.albums.filter((album) => album.id !== albumId),
          })),
        };
      });

      // Return context for rollback
      return { previousAlbums, albumId };
    },
    onError: (err, albumId, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbums) {
        queryClient.setQueryData(
          queryKeys.admin.albums.all(),
          context.previousAlbums
        );
      }
    },
    onSuccess: (data, albumId) => {
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: queryKeys.albums.detail(albumId),
      });

      // Invalidate admin albums list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.albums.all(),
      });

      // Invalidate general albums lists
      invalidateQueries.albumsLists();
    },
  });
}

// Mutation hook for bulk deleting albums (admin)
export function useBulkDeleteAdminAlbums() {
  return useMutation({
    mutationFn: async (albumIds: string[]) => {
      return await adminAlbumsApi.bulkDeleteAlbums(albumIds);
    },
    onMutate: async (albumIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.albums.all(),
      });

      // Snapshot the previous value
      const previousAlbums = queryClient.getQueryData(
        queryKeys.admin.albums.all()
      );

      // Optimistically remove the albums from admin list
      queryClient.setQueryData(queryKeys.admin.albums.all(), (old: InfiniteAdminAlbumsData | undefined) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            albums: page.albums.filter(
              (album) => !albumIds.includes(album.id)
            ),
          })),
        };
      });

      // Return context for rollback
      return { previousAlbums, albumIds };
    },
    onError: (err, albumIds, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbums) {
        queryClient.setQueryData(
          queryKeys.admin.albums.all(),
          context.previousAlbums
        );
      }
    },
    onSuccess: (data, albumIds) => {
      // Remove all deleted albums from cache
      albumIds.forEach((albumId) => {
        queryClient.removeQueries({
          queryKey: queryKeys.albums.detail(albumId),
        });
      });

      // Invalidate admin albums list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.albums.all(),
      });

      // Invalidate general albums lists
      invalidateQueries.albumsLists();
    },
  });
}
