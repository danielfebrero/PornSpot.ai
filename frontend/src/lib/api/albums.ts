import {
  UnifiedAlbumsResponse,
  CreateAlbumRequest,
  UpdateAlbumRequest,
  ApiResponse,
} from "@/types";
import { ApiUtil, PaginationParams } from "../api-util";

// Albums API Functions
export const albumsApi = {
  // Get albums with optional filtering
  getAlbums: async (params?: {
    user?: string; // Parameter for username lookup
    isPublic?: boolean;
    limit?: number;
    cursor?: string;
    tag?: string;
  }): Promise<UnifiedAlbumsResponse> => {
    const response = await ApiUtil.get<UnifiedAlbumsResponse>(
      "/albums",
      params
    );
    return ApiUtil.extractData(response);
  },

  // Get user's albums (convenience method)
  getUserAlbums: async (
    params?: PaginationParams & {
      tag?: string;
    }
  ): Promise<UnifiedAlbumsResponse> => {
    // Fetch current user's albums via session (no user parameter = session-based lookup)
    const response = await ApiUtil.get<UnifiedAlbumsResponse>(
      "/albums",
      params
    );
    return ApiUtil.extractData(response);
  },

  // Create new album
  createAlbum: async (
    data: CreateAlbumRequest
  ): Promise<ApiResponse<{ album: any; message: string }>> => {
    return ApiUtil.request("/albums", { method: "POST", body: data });
  },

  // Update existing album
  updateAlbum: async (
    albumId: string,
    data: UpdateAlbumRequest
  ): Promise<ApiResponse<{ album: any; message: string }>> => {
    return ApiUtil.request(`/albums/${albumId}`, { method: "PUT", body: data });
  },

  // Delete an album
  deleteAlbum: async (albumId: string): Promise<void> => {
    const response = await ApiUtil.delete<any>(`/albums/${albumId}`);
    ApiUtil.extractData(response); // Throws if not successful
  },

  // Add existing media to album (single)
  addMediaToAlbum: async (albumId: string, mediaId: string): Promise<void> => {
    const response = await ApiUtil.post<any>(`/albums/${albumId}/media`, {
      mediaId,
    });
    ApiUtil.extractData(response); // Throws if not successful
  },

  // Add multiple existing media to album (bulk)
  bulkAddMediaToAlbum: async (
    albumId: string,
    mediaIds: string[]
  ): Promise<{
    successfullyAdded: string[];
    failedAdditions: { mediaId: string; error: string }[];
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  }> => {
    const response = await ApiUtil.post<any>(`/albums/${albumId}/media`, {
      mediaIds,
    });
    return ApiUtil.extractData(response).results;
  },

  // Remove media from album
  removeMediaFromAlbum: async (
    albumId: string,
    mediaId: string
  ): Promise<void> => {
    const response = await ApiUtil.delete<any>(
      `/albums/${albumId}/media/${mediaId}`
    );
    ApiUtil.extractData(response); // Throws if not successful
  },

  // Remove multiple media from album (bulk)
  bulkRemoveMediaFromAlbum: async (
    albumId: string,
    mediaIds: string[]
  ): Promise<{
    successfullyRemoved: string[];
    failedRemovals: { mediaId: string; error: string }[];
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  }> => {
    const response = await ApiUtil.delete<any>(
      `/albums/${albumId}/media/bulk-remove`,
      { mediaIds }
    );
    return ApiUtil.extractData(response).results;
  },

  // Get a single album
  getAlbum: async (albumId: string): Promise<any> => {
    const response = await ApiUtil.get<any>(`/albums/${albumId}`);
    return ApiUtil.extractData(response);
  },
};
