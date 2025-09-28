import {
  GenerationResponse,
  GenerationSettings,
  I2VSubmitJobRequest,
  Media,
} from "@/types";
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
    const response = await ApiUtil.post<GenerationResponse>(
      "/generation/generate",
      request,
      { credentials: "include" }
    );
    return ApiUtil.extractData(response);
  },

  // Get usage statistics
  getUsageStats: async (): Promise<UsageStatsResponse> => {
    const response = await ApiUtil.get<UsageStatsResponse>(
      "/generation/usage-stats",
      {
        credentials: "include",
      }
    );
    return ApiUtil.extractData(response);
  },

  // Get user generation settings
  getUserSettings: async (): Promise<UserGenerationSettingsResponse | null> => {
    const response = await ApiUtil.get<UserGenerationSettingsResponse | null>(
      "/user/generation/settings",
      { credentials: "include" }
    );
    return ApiUtil.extractData(response);
  },

  // Submit Image-to-Video job
  submitI2VJob: async (
    request: I2VSubmitJobRequest
  ): Promise<{ jobId: string; estimatedSeconds: number }> => {
    const response = await ApiUtil.post<{
      jobId: string;
      estimatedSeconds: number;
    }>("/generate/i2v/submit", request, { credentials: "include" });
    return ApiUtil.extractData(response);
  },

  // Poll Image-to-Video job status
  pollI2VJob: async (
    jobId: string
  ): Promise<
    | { status: string; delayTime?: number | null; executionTime?: number }
    | { status: "COMPLETED"; media: Media }
  > => {
    const response = await ApiUtil.get<
      | { status: string; delayTime?: number | null; executionTime?: number }
      | { status: "COMPLETED"; media: Media }
    >(`/generate/i2v/poll?jobId=${encodeURIComponent(jobId)}` as any, {
      credentials: "include",
    });
    return ApiUtil.extractData(response);
  },

  // Get incomplete I2V jobs for current user
  getIncompleteI2VJobs: async (): Promise<
    {
      jobId: string;
      submittedAt?: string;
      estimatedSeconds?: number;
      estimatedCompletionTimeAt?: string;
      media: Media | null;
    }[]
  > => {
    const response = await ApiUtil.get<
      {
        jobId: string;
        submittedAt?: string;
        estimatedSeconds?: number;
        estimatedCompletionTimeAt?: string;
        media: Media | null;
      }[]
    >("/generate/i2v/incomplete", { credentials: "include" });
    return ApiUtil.extractData(response);
  },

  // Get failed I2V jobs for current user
  getFailedI2VJobs: async (): Promise<
    {
      jobId: string;
      submittedAt?: string;
      failedAt?: string;
      estimatedSeconds?: number;
      media: Media | null;
      retryJobId?: string;
    }[]
  > => {
    const response = await ApiUtil.get<
      {
        jobId: string;
        submittedAt?: string;
        failedAt?: string;
        estimatedSeconds?: number;
        media: Media | null;
        retryJobId?: string;
      }[]
    >("/generate/i2v/failed", { credentials: "include" });
    return ApiUtil.extractData(response);
  },

  // Retry a failed I2V job
  retryI2VJob: async (
    jobId: string
  ): Promise<{
    previousJobId: string;
    job: {
      jobId: string;
      submittedAt?: string;
      estimatedSeconds?: number;
      estimatedCompletionTimeAt?: string;
      media: Media | null;
      retryOfJobId?: string;
    };
  }> => {
    const response = await ApiUtil.post<{
      previousJobId: string;
      job: {
        jobId: string;
        submittedAt?: string;
        estimatedSeconds?: number;
        estimatedCompletionTimeAt?: string;
        media: Media | null;
        retryOfJobId?: string;
      };
    }>("/generate/i2v/retry", { jobId }, { credentials: "include" });
    return ApiUtil.extractData(response);
  },
};
