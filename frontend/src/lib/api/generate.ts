import { GenerationResponse, GenerationSettings } from "@/types";
import { ApiUtil } from "../api-util";

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
};
