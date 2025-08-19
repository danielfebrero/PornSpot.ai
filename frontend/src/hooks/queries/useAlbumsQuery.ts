import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { albumsApi } from "@/lib/api";
import {
  queryKeys,
  queryClient,
  updateCache,
  invalidateQueries,
} from "@/lib/queryClient";
import {
  Album,
  UnifiedAlbumsResponse,
  Media,
  CreateAlbumRequest,
  UpdateAlbumRequest,
  InfiniteMediaQueryData,
} from "@/types";

// Types - using shared request types
type CreateAlbumData = CreateAlbumRequest;
type UpdateAlbumData = UpdateAlbumRequest;

interface AlbumMediaResponse {
  media: Media[];
  nextCursor: string | undefined;
  hasNext: boolean;
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

// Use the new unified response type
type AlbumsResponse = UnifiedAlbumsResponse;

// Hook for fetching albums list with infinite scroll support
export function useAlbums(params: AlbumsQueryParams = {}) {
  const { limit = 12, initialData, ...restParams } = params;

  // Transform initial data for TanStack Query if provided
  const transformedInitialData = initialData
    ? {
        pages: [
          {
            albums: initialData.albums,
            pagination: {
              hasNext: initialData.pagination?.hasNext || false,
              cursor: initialData.pagination?.cursor || null,
              limit: limit, // Include the limit field
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
      return lastPage.pagination?.hasNext
        ? lastPage.pagination.cursor
        : undefined;
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
    getNextPageParam: (lastPage: AlbumMediaResponse) => {
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
    onSuccess: (response) => {
      // Extract album data from API response
      const newAlbum = response.data?.album;
      if (newAlbum) {
        // Optimistically update the cache
        updateCache.albumInLists(newAlbum, "add");
      }

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

      // Optimistically update the detail cache
      queryClient.setQueryData(
        queryKeys.albums.detail(albumId),
        (old: Album | undefined) => {
          return old ? { ...old, ...data } : old;
        }
      );

      // Optimistically update ALL album lists (not just generic lists)
      queryClient.setQueriesData(
        { queryKey: queryKeys.albums.lists() },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle infinite query format
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                albums:
                  page.albums?.map((album: Album) =>
                    album.id === albumId ? { ...album, ...data } : album
                  ) || [],
              })),
            };
          }

          // Handle regular query format
          if (oldData.albums) {
            return {
              ...oldData,
              albums: oldData.albums.map((album: Album) =>
                album.id === albumId ? { ...album, ...data } : album
              ),
            };
          }

          return oldData;
        }
      );

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

        // Restore previous album state in all lists
        queryClient.setQueriesData(
          { queryKey: queryKeys.albums.lists() },
          (oldData: any) => {
            if (!oldData) return oldData;

            // Handle infinite query format
            if (oldData.pages) {
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  albums:
                    page.albums?.map((album: Album) =>
                      album.id === context.albumId
                        ? context.previousAlbum
                        : album
                    ) || [],
                })),
              };
            }

            // Handle regular query format
            if (oldData.albums) {
              return {
                ...oldData,
                albums: oldData.albums.map((album: Album) =>
                  album.id === context.albumId ? context.previousAlbum : album
                ),
              };
            }

            return oldData;
          }
        );
      }
      // Invalidate to refetch correct data as fallback
      invalidateQueries.album(variables.albumId);
      invalidateQueries.albumsLists();
    },
    onSuccess: (response, { albumId }) => {
      // Extract album data from API response
      const updatedAlbum = response.data?.album;
      if (updatedAlbum) {
        // Ensure the cache is up to date with server response
        queryClient.setQueryData(
          queryKeys.albums.detail(albumId),
          updatedAlbum
        );

        // Update the album in all lists with server response
        queryClient.setQueriesData(
          { queryKey: queryKeys.albums.lists() },
          (oldData: any) => {
            if (!oldData) return oldData;

            // Handle infinite query format
            if (oldData.pages) {
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  albums:
                    page.albums?.map((album: Album) =>
                      album.id === albumId ? updatedAlbum : album
                    ) || [],
                })),
              };
            }

            // Handle regular query format
            if (oldData.albums) {
              return {
                ...oldData,
                albums: oldData.albums.map((album: Album) =>
                  album.id === albumId ? updatedAlbum : album
                ),
              };
            }

            return oldData;
          }
        );
      }
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

      // Optimistically remove from ALL album lists (not just generic lists)
      queryClient.setQueriesData(
        { queryKey: queryKeys.albums.lists() },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle infinite query format
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                albums:
                  page.albums?.filter((album: Album) => album.id !== albumId) ||
                  [],
              })),
            };
          }

          // Handle regular query format
          if (oldData.albums) {
            return {
              ...oldData,
              albums: oldData.albums.filter(
                (album: Album) => album.id !== albumId
              ),
            };
          }

          return oldData;
        }
      );

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

        // Restore album to all lists
        queryClient.setQueriesData(
          { queryKey: queryKeys.albums.lists() },
          (oldData: any) => {
            if (!oldData) return oldData;

            // Handle infinite query format
            if (oldData.pages) {
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  albums: [context.previousAlbum, ...(page.albums || [])],
                })),
              };
            }

            // Handle regular query format
            if (oldData.albums) {
              return {
                ...oldData,
                albums: [context.previousAlbum, ...oldData.albums],
              };
            }

            return oldData;
          }
        );
      }
      // Invalidate to refetch correct data as fallback
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
      // Cancel any outgoing refetches for album media and album detail
      await queryClient.cancelQueries({
        queryKey: ["media", "album", albumId],
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.albums.detail(albumId),
      });

      // Snapshot the previous values
      const previousAlbumMedia = queryClient.getQueriesData({
        queryKey: ["media", "album", albumId],
      });
      const previousAlbum = queryClient.getQueryData(
        queryKeys.albums.detail(albumId)
      );

      // Optimistically remove the media from album media infinite query
      queryClient.setQueriesData(
        { queryKey: ["media", "album", albumId] },
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

      // Optimistically update the album's media count in detail cache
      queryClient.setQueryData(
        queryKeys.albums.detail(albumId),
        (old: Album | undefined) => {
          return old
            ? {
                ...old,
                mediaCount: Math.max(0, (old.mediaCount || 0) - 1),
                lastModified: new Date().toISOString(),
              }
            : old;
        }
      );

      // Optimistically update ALL album lists to decrement media count
      queryClient.setQueriesData(
        { queryKey: queryKeys.albums.lists() },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle infinite query format
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                albums:
                  page.albums?.map((album: Album) =>
                    album.id === albumId
                      ? {
                          ...album,
                          mediaCount: Math.max(0, (album.mediaCount || 0) - 1),
                          lastModified: new Date().toISOString(),
                        }
                      : album
                  ) || [],
              })),
            };
          }

          // Handle regular query format
          if (oldData.albums) {
            return {
              ...oldData,
              albums: oldData.albums.map((album: Album) =>
                album.id === albumId
                  ? {
                      ...album,
                      mediaCount: Math.max(0, (album.mediaCount || 0) - 1),
                      lastModified: new Date().toISOString(),
                    }
                  : album
              ),
            };
          }

          return oldData;
        }
      );

      // Return context for rollback
      return { previousAlbumMedia, previousAlbum, albumId, mediaId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousAlbumMedia) {
        context.previousAlbumMedia.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      // Rollback album detail optimistic update
      if (context?.previousAlbum) {
        queryClient.setQueryData(
          queryKeys.albums.detail(context.albumId),
          context.previousAlbum
        );

        // Restore previous album state in all lists
        queryClient.setQueriesData(
          { queryKey: queryKeys.albums.lists() },
          (oldData: any) => {
            if (!oldData) return oldData;

            // Handle infinite query format
            if (oldData.pages) {
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  albums:
                    page.albums?.map((album: Album) =>
                      album.id === context.albumId
                        ? context.previousAlbum
                        : album
                    ) || [],
                })),
              };
            }

            // Handle regular query format
            if (oldData.albums) {
              return {
                ...oldData,
                albums: oldData.albums.map((album: Album) =>
                  album.id === context.albumId ? context.previousAlbum : album
                ),
              };
            }

            return oldData;
          }
        );
      }

      console.error("Failed to remove media from album:", err);
    },
    onSuccess: (data, variables) => {
      // Invalidate user media queries in case media appears there
      queryClient.invalidateQueries({
        queryKey: ["media", "user"],
      });

      // Invalidate the specific album to update counts
      invalidateQueries.album(variables.albumId);

      // Invalidate album media queries
      invalidateQueries.albumMediaList(variables.albumId);

      // Invalidate albums lists to ensure consistency
      invalidateQueries.albumsLists();

      // Invalidate the specific media item
      invalidateQueries.media(variables.mediaId);
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
    onMutate: async ({ albumId, mediaId }) => {
      // Cancel outgoing refetches for the album detail
      await queryClient.cancelQueries({
        queryKey: queryKeys.albums.detail(albumId),
      });

      // Snapshot the previous album data
      const previousAlbum = queryClient.getQueryData(
        queryKeys.albums.detail(albumId)
      );

      // Optimistically update the album's media count in detail cache
      queryClient.setQueryData(
        queryKeys.albums.detail(albumId),
        (old: Album | undefined) => {
          return old
            ? {
                ...old,
                mediaCount: (old.mediaCount || 0) + 1,
                // Optionally update lastModified timestamp
                lastModified: new Date().toISOString(),
              }
            : old;
        }
      );

      // Optimistically update ALL album lists to increment media count
      queryClient.setQueriesData(
        { queryKey: queryKeys.albums.lists() },
        (oldData: any) => {
          if (!oldData) return oldData;

          // Handle infinite query format
          if (oldData.pages) {
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                albums:
                  page.albums?.map((album: Album) =>
                    album.id === albumId
                      ? {
                          ...album,
                          mediaCount: (album.mediaCount || 0) + 1,
                          lastModified: new Date().toISOString(),
                        }
                      : album
                  ) || [],
              })),
            };
          }

          // Handle regular query format
          if (oldData.albums) {
            return {
              ...oldData,
              albums: oldData.albums.map((album: Album) =>
                album.id === albumId
                  ? {
                      ...album,
                      mediaCount: (album.mediaCount || 0) + 1,
                      lastModified: new Date().toISOString(),
                    }
                  : album
              ),
            };
          }

          return oldData;
        }
      );

      // Return context with previous data for rollback
      return { previousAlbum, albumId, mediaId };
    },
    onError: (error, variables, context) => {
      console.error("Failed to add media to album:", error);

      // Rollback optimistic update
      if (context?.previousAlbum) {
        queryClient.setQueryData(
          queryKeys.albums.detail(context.albumId),
          context.previousAlbum
        );

        // Restore previous album state in all lists
        queryClient.setQueriesData(
          { queryKey: queryKeys.albums.lists() },
          (oldData: any) => {
            if (!oldData) return oldData;

            // Handle infinite query format
            if (oldData.pages) {
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  albums:
                    page.albums?.map((album: Album) =>
                      album.id === context.albumId
                        ? context.previousAlbum
                        : album
                    ) || [],
                })),
              };
            }

            // Handle regular query format
            if (oldData.albums) {
              return {
                ...oldData,
                albums: oldData.albums.map((album: Album) =>
                  album.id === context.albumId ? context.previousAlbum : album
                ),
              };
            }

            return oldData;
          }
        );
      }

      // Invalidate to refetch correct data as fallback
      invalidateQueries.album(variables.albumId);
      invalidateQueries.albumMedia(variables.albumId);
      invalidateQueries.albumMediaList(variables.albumId);
      invalidateQueries.albumsLists();
    },
    onSuccess: (data, variables) => {
      // Invalidate the album detail to get fresh data from server
      // This ensures we have the latest media count and any other updated fields
      invalidateQueries.album(variables.albumId);

      // Invalidate album media queries to refresh the media list when navigating to the album
      invalidateQueries.albumMedia(variables.albumId);
      invalidateQueries.albumMediaList(variables.albumId);

      // Optionally invalidate albums lists to ensure consistency
      invalidateQueries.albumsLists();
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
