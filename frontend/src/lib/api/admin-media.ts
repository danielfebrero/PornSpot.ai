import { ApiUtil, PaginationParams } from "../api-util";
import { UnifiedMediaResponse, UploadMediaRequest } from "@/types";

// Admin Media API Functions
export const adminMediaApi = {
  // Get all media items across all users (admin view)
  getMediaList: async (
    params?: PaginationParams
  ): Promise<UnifiedMediaResponse> => {
    const response = await ApiUtil.get<UnifiedMediaResponse>(
      "/admin/media",
      params
    );
    return ApiUtil.extractData(response);
  },

  // Get album media (admin view) - reuses existing endpoint with admin access
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

  // Delete media completely (admin endpoint)
  deleteMedia: async (mediaId: string): Promise<void> => {
    await ApiUtil.delete(`/admin/media/${mediaId}`);
  },

  // Upload media (admin - uses existing media API endpoint)
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
};
