import { ApiUtil } from "../api-util";
import { Album, Media } from "@/types";

export interface DiscoverResponse {
  items: (Album | Media)[];
  pagination: {
    hasNext: boolean;
    cursor: string | null;
    limit: number;
  };
}

export interface DiscoverParams {
  isPublic?: boolean;
  includeContentPreview?: boolean;
  limit?: number;
  cursor?: string;
  tag?: string;
}

// Discover API Functions
export const discoverApi = {
  // Get mixed content (albums and media) for discovery
  getDiscover: async (params?: DiscoverParams): Promise<DiscoverResponse> => {
    const response = await ApiUtil.get<DiscoverResponse>("/discover", params);
    return ApiUtil.extractData(response);
  },
};
