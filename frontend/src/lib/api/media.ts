import { Media, UnifiedMediaResponse } from "@/types";
import { ApiUtil, PaginationParams } from "../api-util";

// Media API Functions
export const mediaApi = {
  // Get user's media - NEW UNIFIED FORMAT
  getUserMedia: async (params?: PaginationParams): Promise<UnifiedMediaResponse> => {
    const response = await ApiUtil.get<UnifiedMediaResponse>("/user/media", params);
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
    const response = await ApiUtil.get<{ data: Media }>(`/media/${mediaId}`);
    return ApiUtil.extractData(response);
  },

  // Upload media to album
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
    const response = await ApiUtil.post<{
      data: {
        mediaId: string;
        uploadUrl: string;
        key: string;
        expiresIn: number;
      }
    }>(`/albums/${albumId}/media`, mediaData);
    return ApiUtil.extractData(response);
  },

  // Delete media
  deleteMedia: async (mediaId: string): Promise<void> => {
    await ApiUtil.delete(`/media/${mediaId}`);
  },
};
