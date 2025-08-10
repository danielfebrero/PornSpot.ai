import { useQuery, useMutation } from "@tanstack/react-query";
import { mediaApi } from "@/lib/api";
import { queryKeys, queryClient, invalidateQueries } from "@/lib/queryClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

// Admin media API functions
const adminMediaApi = {
  // Delete media (admin endpoint)
  deleteMedia: async (albumId: string, mediaId: string): Promise<void> => {
    const response = await fetch(
      `${API_URL}/admin/media/${albumId}/${mediaId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        // response body is not JSON
      }
      const errorMessage =
        (errorData && (errorData.error || errorData.message)) ||
        `Failed to delete media: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Failed to delete media");
    }
  },

  // Upload media (admin - uses existing media API endpoint)
  uploadMedia: async (
    albumId: string,
    mediaData: {
      filename: string;
      mimeType: string;
      size: number;
    }
  ): Promise<{
    mediaId: string;
    uploadUrl: string;
    key: string;
    expiresIn: number;
  }> => {
    const response = await fetch(`${API_URL}/albums/${albumId}/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(mediaData),
    });

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        // response body is not JSON
      }
      const errorMessage =
        (errorData && (errorData.error || errorData.message)) ||
        `Failed to upload media: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error || "Failed to upload media");
    }
  },
};

// Hook for fetching album media (admin view)
// This reuses the existing album media API but with admin-specific query keys
export function useAdminAlbumMedia(
  albumId: string,
  params: { limit?: number } = {}
) {
  const { limit = 20 } = params;

  return useQuery({
    queryKey: ["admin", "media", "album", albumId, { limit }],
    queryFn: async () => {
      return await mediaApi.getAlbumMedia(albumId, { limit });
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
    queryKey: ["admin", "media", "list", albumIds],
    queryFn: async () => {
      // Fetch media for multiple albums for admin overview
      if (albumIds.length === 0) return { media: [] };

      const promises = albumIds.map((albumId) =>
        mediaApi.getAlbumMedia(albumId, { limit: 100 })
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

// Mutation hook for admin media deletion
export function useAdminDeleteMedia() {
  return useMutation({
    mutationFn: async ({
      albumId,
      mediaId,
    }: {
      albumId: string;
      mediaId: string;
    }) => {
      return await adminMediaApi.deleteMedia(albumId, mediaId);
    },
    onMutate: async ({ albumId, mediaId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["admin", "media", "album", albumId],
      });

      // Snapshot the previous value
      const previousMedia = queryClient.getQueryData([
        "admin",
        "media",
        "album",
        albumId,
      ]);

      // Optimistically remove the media
      queryClient.setQueryData(
        ["admin", "media", "album", albumId],
        (old: any) => {
          if (!old?.media) return old;
          return {
            ...old,
            media: old.media.filter((m: any) => m.id !== mediaId),
          };
        }
      );

      // Return context for rollback
      return { previousMedia, albumId, mediaId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousMedia && context?.albumId) {
        queryClient.setQueryData(
          ["admin", "media", "album", context.albumId],
          context.previousMedia
        );
      }
    },
    onSuccess: (data, variables) => {
      // Remove from cache completely
      queryClient.removeQueries({
        queryKey: queryKeys.media.detail(variables.mediaId),
      });

      // Invalidate related queries
      invalidateQueries.media(variables.mediaId);
      invalidateQueries.album(variables.albumId);

      // Invalidate admin-specific queries
      queryClient.invalidateQueries({
        queryKey: ["admin", "media"],
      });
    },
  });
}

// Mutation hook for batch operations (admin)
export function useAdminBatchDeleteMedia() {
  return useMutation({
    mutationFn: async (
      mediaItems: Array<{ albumId: string; mediaId: string }>
    ) => {
      // Execute deletions in parallel
      const promises = mediaItems.map((item) =>
        adminMediaApi.deleteMedia(item.albumId, item.mediaId)
      );
      return await Promise.all(promises);
    },
    onSuccess: (data, variables) => {
      // Invalidate all admin media queries
      queryClient.invalidateQueries({
        queryKey: ["admin", "media"],
      });

      // Invalidate related album and media queries
      variables.forEach((item) => {
        invalidateQueries.media(item.mediaId);
        invalidateQueries.album(item.albumId);
      });
    },
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
      mediaData: {
        filename: string;
        mimeType: string;
        size: number;
      };
    }) => {
      return await adminMediaApi.uploadMedia(albumId, mediaData);
    },
    onSuccess: (data, variables) => {
      // Invalidate admin album media queries
      queryClient.invalidateQueries({
        queryKey: ["admin", "media", "album", variables.albumId],
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
