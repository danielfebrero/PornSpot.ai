import { ApiUtil } from "../api-util";
import {
  Album,
  CreateAdminAlbumRequest,
  UpdateAdminAlbumRequest,
} from "@/types";

// Admin Albums API Functions
export const adminAlbumsApi = {
  // Get all albums with pagination (admin view)
  getAlbums: async (params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{
    albums: Album[];
    pagination: {
      hasNext: boolean;
      cursor: string | null;
      limit: number;
    };
  }> => {
    const response = await ApiUtil.get<{
      albums: Album[];
      pagination: {
        hasNext: boolean;
        cursor: string | null;
        limit: number;
      };
    }>("/admin/albums", params);
    return ApiUtil.extractData(response);
  },

  // Create a new album (admin)
  createAlbum: async (albumData: CreateAdminAlbumRequest): Promise<any> => {
    const response = await ApiUtil.post<any>("/albums", albumData);
    return ApiUtil.extractData(response);
  },

  // Update an album (admin)
  updateAlbum: async (
    albumId: string,
    updates: UpdateAdminAlbumRequest
  ): Promise<any> => {
    const response = await ApiUtil.put<any>(
      `/admin/albums/${albumId}`,
      updates
    );
    return ApiUtil.extractData(response);
  },

  // Delete an album (admin)
  deleteAlbum: async (albumId: string): Promise<void> => {
    await ApiUtil.delete<void>(`/admin/albums/${albumId}`);
  },

  // Bulk delete albums (admin)
  bulkDeleteAlbums: async (albumIds: string[]): Promise<void> => {
    await ApiUtil.delete<void>("/admin/albums/bulk-delete", { albumIds });
  },

  // Get a single album (admin)
  getAlbum: async (albumId: string): Promise<any> => {
    const response = await ApiUtil.get<any>(`/albums/${albumId}`);
    return ApiUtil.extractData(response);
  },

  // Remove media from album (admin endpoint)
  removeMedia: async (albumId: string, mediaId: string): Promise<void> => {
    await ApiUtil.delete(`/admin/albums/${albumId}/media/${mediaId}`);
  },
};
