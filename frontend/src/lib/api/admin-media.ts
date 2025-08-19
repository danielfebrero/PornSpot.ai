import { ApiUtil } from "../api-util";
import { Media } from "@/types";

// Admin Media API Functions
export const adminMediaApi = {
  // Get all media items across all users (admin view)
  getMediaList: async (params?: {
    limit?: number;
    cursor?: string;
  }): Promise<{
    media: Media[];
    pagination: {
      hasNext: boolean;
      cursor: string | null;
      limit: number;
    };
  }> => {
    const response = await ApiUtil.get<{
      media: Media[];
      pagination: {
        hasNext: boolean;
        cursor: string | null;
        limit: number;
      };
    }>("/admin/media", params);
    return ApiUtil.extractData(response);
  },
};
