import { ApiUtil } from "../api-util";
import { DiscoverContent, DiscoverParams } from "@/types/shared-types";

// Discover API Functions
export const discoverApi = {
  // Get mixed content (albums and media) for discovery
  getDiscover: async (params?: DiscoverParams): Promise<DiscoverContent> => {
    const response = await ApiUtil.get<DiscoverContent>("/discover", params);
    return ApiUtil.extractData(response);
  },
};
