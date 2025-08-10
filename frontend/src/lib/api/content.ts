import { ApiUtil } from "../api-util";

// Content API Functions
export const contentApi = {
  // Get view counts for multiple targets (bulk fetch)
  getViewCounts: async (
    targets: Array<{
      targetType: "album" | "media";
      targetId: string;
    }>
  ): Promise<{
    viewCounts: Array<{
      targetType: "album" | "media";
      targetId: string;
      viewCount: number;
    }>;
  }> => {
    // Use custom config to disable credentials for this public endpoint
    const response = await ApiUtil.request<{
      viewCounts: Array<{
        targetType: "album" | "media";
        targetId: string;
        viewCount: number;
      }>;
    }>("/content/view-count", {
      method: "POST",
      body: { targets },
      credentials: "omit", // No credentials needed for public view count endpoint
    });

    return ApiUtil.extractData(response);
  },
};
