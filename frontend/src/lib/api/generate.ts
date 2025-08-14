import { GenerationResponse, GenerationSettings } from "@/types";
import { ApiUtil } from "../api-util";

export interface OptimizePromptStreamEvent {
  type:
    | "optimization_start"
    | "optimization_token"
    | "optimization_complete"
    | "optimization_error";
  originalPrompt: string;
  optimizedPrompt: string;
  token?: string;
  completed: boolean;
  error?: string;
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

  // Stream prompt optimization
  optimizePromptStream: async function* (
    prompt: string
  ): AsyncGenerator<OptimizePromptStreamEvent, void, unknown> {
    yield* ApiUtil.streamRequest<OptimizePromptStreamEvent>(
      "/generation/optimize-prompt-stream",
      {
        method: "POST",
        body: { prompt },
        credentials: "include",
      }
    );
  },
};
