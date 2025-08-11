import type { Media } from "./media";

export interface GenerationSettings {
  prompt: string;
  negativePrompt: string;
  imageSize: string;
  customWidth: number;
  customHeight: number;
  batchCount: number;
  selectedLoras: string[];
  loraStrengths: Record<string, { mode: "auto" | "manual"; value: number }>;
  loraSelectionMode: "auto" | "manual";
  optimizePrompt: boolean;
}

export interface GenerationResponse {
  queueId: string;
  queuePosition: number;
  estimatedWaitTime: number;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  images?: Media[];
}

export interface WorkflowFinalParams {
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  batch_size: number;
  loraSelectionMode: "auto" | "manual";
  loraStrengths: Record<string, { mode: "auto" | "manual"; value: number }>;
  selectedLoras: string[];
  optimizePrompt: boolean;
  prompt: string;
  negativePrompt: string;
}
