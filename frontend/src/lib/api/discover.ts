import { ApiUtil } from "../api-util";
import { DiscoverContent, DiscoverParams } from "@/types/shared-types";

// Discover API Functions
export const discoverApi = {
  // Get mixed content (albums and media) for discovery
  getDiscover: async (params?: DiscoverParams): Promise<DiscoverContent> => {
    const { fetchOptions, ...apiParams } = params || {};
    const response = await ApiUtil.get<DiscoverContent>(
      "/discover",
      apiParams,
      fetchOptions
    );
    return ApiUtil.extractData(response);
  },
};
