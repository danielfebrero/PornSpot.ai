/**
 * @fileoverview Generation Shared Types
 * @description Types for AI image generation requests, responses, and queue management.
 * @notes
 * - WorkflowParameters for prompt, dimensions, batch, etc.
 * - QueueEntry for queue items.
 * - QueueStats for queue statistics.
 * - GenerationProgress for real-time updates.
 * - ComfyUIPromptResponse, ComfyUIMessage, ComfyUIMessageData, ComfyUIImageResult, ComfyUISystemStats, ComfyUIQueueItem, ComfyUIHistoryResult from ComfyUI integration.
 */
import type { Media } from "./media";

export interface GenerationSettings {
  prompt: string;
  originalPrompt?: string;
  negativePrompt: string;
  imageSize: string;
  customWidth: number;
  customHeight: number;
  batchCount: number;
  selectedLoras: string[];
  loraStrengths: Record<string, { mode: "auto" | "manual"; value: number }>;
  loraSelectionMode: "auto" | "manual";
  optimizePrompt: boolean;
  isPublic?: boolean;
  connectionId?: string;
  cfgScale?: number;
  steps?: number;
  seed?: number;
}

export interface GenerationRequest extends GenerationSettings {}

export interface WorkflowNode {
  nodeId: string;
  classType: string;
  nodeTitle: string;
  dependencies: string[];
  estTimeUnits: number;
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  totalNodes: number;
  currentNodeIndex: number;
  nodeOrder: string[];
}

export interface GenerationResponse {
  queueId: string;
  queuePosition: number;
  estimatedWaitTime: number;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  images?: Media[];
  workflowData?: WorkflowData;
  optimizedPrompt?: string;
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
  seed?: number;
  isPublic?: boolean;
}

export interface I2VSettings {
  videoLength: 5 | 8 | 10 | 15 | 20 | 25 | 30;
  prompt: string;
  negativePrompt: string;
  seed: string;
  flowShift: number; // Range 1 to 10
  inferenceSteps: number; // Range 20 to 40
  cfgScale: number; // Range 1 to 10
  optimizePrompt: boolean;
  isPublic: boolean;
  enableLoras: boolean;
  mode?: "image-to-video" | "video-extension"; // Optional hint for backend to differentiate flows
}

export interface I2VSubmitJobRequest extends I2VSettings {
  mediaId: string;
}

export interface I2VPollJobRequest {
  jobId: string;
}

export interface StopGenerationRequest {
  queueId: string;
  connectionId?: string;
}

export interface StopGenerationResponse {
  queueId: string;
  status: "stopped";
}
