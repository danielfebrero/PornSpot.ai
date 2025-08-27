import { GenerationResponse, GenerationSettings } from "@/types";
import { ApiUtil } from "../api-util";

export interface UsageStatsResponse {
  allowed: boolean;
  reason?: string;
  remaining?: number | "unlimited";
  userId: string | null;
  plan?: "free" | "starter" | "pro" | "unlimited";
}

export interface UserGenerationSettingsResponse {
  imageSize: string;
  customWidth: number;
  customHeight: number;
  batchCount: number;
  isPublic: boolean;
  cfgScale: number;
  steps: number;
  negativePrompt: string;
  lastUpdated: string;
}

// Generate API Functions
export const generateApi = {
  // Generate image
  generate: async (
    request: GenerationSettings
  ): Promise<GenerationResponse> => {
    // Use custom config to disable credentials for this public endpoint
    const response = await ApiUtil.request<GenerationResponse>(
      "/generation/generate",
      {
        method: "POST",
        body: request,
        credentials: "include", // No credentials needed for public view count endpoint
      }
    );

    return ApiUtil.extractData(response);
  },

  // Get usage statistics
  getUsageStats: async (): Promise<UsageStatsResponse> => {
    const response = await ApiUtil.request<UsageStatsResponse>(
      "/generation/usage-stats",
      {
        method: "GET",
        credentials: "include",
      }
    );

    return ApiUtil.extractData(response);
  },

  // Get user generation settings
  getUserSettings: async (): Promise<UserGenerationSettingsResponse | null> => {
    const response =
      await ApiUtil.request<UserGenerationSettingsResponse | null>(
        "/user/generation/settings",
        {
          method: "GET",
          credentials: "include",
        }
      );

    return ApiUtil.extractData(response);
  },
};
