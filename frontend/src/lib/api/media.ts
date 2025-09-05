import { Media, UnifiedMediaResponse, UploadMediaRequest } from "@/types";
import { ApiUtil, PaginationParams } from "../api-util";

// Types for media API parameters
interface GetUserMediaParams extends PaginationParams {
  username?: string;
}

// Media API Functions
export const mediaApi = {
  // Get user's media - NEW UNIFIED FORMAT
  getUserMedia: async (
    params?: GetUserMediaParams
  ): Promise<UnifiedMediaResponse> => {
    const response = await ApiUtil.get<UnifiedMediaResponse>(
      "/user/media",
      params
    );
    return ApiUtil.extractData(response);
  },

  // Get album media - NEW UNIFIED FORMAT
  getAlbumMedia: async (
    albumId: string,
    params?: PaginationParams
  ): Promise<UnifiedMediaResponse> => {
    const response = await ApiUtil.get<UnifiedMediaResponse>(
      `/albums/${albumId}/media`,
      params
    );
    return ApiUtil.extractData(response);
  },

  // Get media by ID
  getMediaById: async (mediaId: string): Promise<Media> => {
    const response = await ApiUtil.get<Media>(`/media/${mediaId}`);
    return ApiUtil.extractData(response);
  },

  // Upload media to album
  uploadMedia: async (
    albumId: string,
    mediaData: UploadMediaRequest
  ): Promise<{
    mediaId: string;
    uploadUrl: string;
    key: string;
    expiresIn: number;
  }> => {
    const response = await ApiUtil.post<{
      mediaId: string;
      uploadUrl: string;
      key: string;
      expiresIn: number;
    }>(`/albums/${albumId}/media`, mediaData);
    return ApiUtil.extractData(response);
  },

  // Delete media
  deleteMedia: async (mediaId: string): Promise<void> => {
    await ApiUtil.delete(`/media/${mediaId}`);
  },

  // Bulk delete media
  bulkDeleteMedia: async (
    mediaIds: string[]
  ): Promise<{
    message: string;
    results: Array<{
      mediaId: string;
      success: boolean;
      error?: string;
      filename?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
    affectedAlbums: string[];
  }> => {
    const response = await ApiUtil.delete<{
      message: string;
      results: Array<{
        mediaId: string;
        success: boolean;
        error?: string;
        filename?: string;
      }>;
      summary: {
        total: number;
        successful: number;
        failed: number;
      };
      affectedAlbums: string[];
    }>("/media/bulk", { mediaIds }, {});
    return ApiUtil.extractData(response);
  },

  // Update media properties (title, visibility, etc.)
  updateMedia: async (
    mediaId: string,
    updates: Partial<{
      title: string;
      isPublic: boolean;
      // Add other updatable fields as needed
    }>
  ): Promise<Media> => {
    const response = await ApiUtil.put<Media>(`/media/${mediaId}`, updates);
    return ApiUtil.extractData(response);
  },

  // Download multiple media files as zip
  downloadZip: async (mediaIds: string[]): Promise<void> => {
    await ApiUtil.download("/media/download-zip", { mediaIds });
  },
};
