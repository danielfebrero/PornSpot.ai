import { ApiUtil } from "../api-util";
import { ViewCountTarget, ViewCountResponse } from "@/types";

// Content API Functions
export const contentApi = {
  // Get view counts for multiple targets (bulk fetch)
  getViewCounts: async (
    targets: ViewCountTarget[]
  ): Promise<ViewCountResponse> => {
    // Use custom config to disable credentials for this public endpoint
    const response = await ApiUtil.request<ViewCountResponse>(
      "/content/view-count",
      {
        method: "POST",
        body: { targets },
        credentials: "omit", // No credentials needed for public view count endpoint
      }
    );

    return ApiUtil.extractData(response);
  },
};
