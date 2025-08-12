/**
 * Standardized ComfyUI Event Interfaces
 *
 * This file defines the complete event structure used throughout the ComfyUI monitoring system.
 * All events flow from the Python monitor to backend lambdas via EventBridge and then to
 * frontend via WebSocket.
 */

// Base interface for all ComfyUI events
export interface BaseComfyUIEvent {
  timestamp: string;
  clientId: string;
  promptId: string;
}

// Monitor lifecycle events
export interface MonitorInitializedEvent extends BaseComfyUIEvent {
  comfyuiHost: string;
  version: string;
}

export interface MonitorStoppedEvent extends BaseComfyUIEvent {
  reason: string;
}

// Job lifecycle events
export interface JobStartedEvent extends BaseComfyUIEvent {
  // No additional fields needed
}

export interface JobCompletedEvent extends BaseComfyUIEvent {
  executionData: {
    promptId: string;
    output: {
      [nodeId: string]: {
        images?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

export interface JobFailedEvent extends BaseComfyUIEvent {
  error: {
    type: string;
    message: string;
    nodeId?: string;
    nodeType?: string;
    traceback?: string[];
  };
}

// Progress tracking events
export interface NodeProgressEvent extends BaseComfyUIEvent {
  nodeId: string;
  displayNodeId: string;
  nodeProgress: number;
  nodeMaxProgress: number;
  nodePercentage: number;
  nodeState: string;
  parentNodeId?: string;
  realNodeId?: string;
  nodeTitle?: string;
}

export interface NodeExecutingEvent extends BaseComfyUIEvent {
  nodeId: string;
  executionData: any;
}

export interface NodeExecutedEvent extends BaseComfyUIEvent {
  nodeId: string;
  output: {
    images?: Array<{
      filename: string;
      subfolder: string;
      type: string;
    }>;
    [key: string]: any;
  };
}

export interface ImagesGeneratedEvent extends BaseComfyUIEvent {
  nodeId: string;
  images: Array<{
    filename: string;
    subfolder: string;
    type: string;
  }>;
  output: any;
}

// Queue status events
export interface QueueStatusEvent extends BaseComfyUIEvent {
  queueRemaining: number;
  execInfo: {
    queueRemaining: number;
    [key: string]: any;
  };
}

// Union type for all ComfyUI events
export type ComfyUIEvent =
  | MonitorInitializedEvent
  | MonitorStoppedEvent
  | JobStartedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | NodeProgressEvent
  | NodeExecutingEvent
  | NodeExecutedEvent
  | ImagesGeneratedEvent
  | QueueStatusEvent;

// Event type constants for consistency
export const COMFYUI_EVENT_TYPES = {
  MONITOR_INITIALIZED: "Monitor Initialized",
  MONITOR_STOPPED: "Monitor Stopped",
  JOB_STARTED: "Job Started",
  JOB_COMPLETED: "Job Completed",
  JOB_FAILED: "Job Failed",
  NODE_PROGRESS: "Node Progress Update",
  NODE_EXECUTING: "Node Executing",
  NODE_EXECUTED: "Node Executed",
  IMAGES_GENERATED: "Images Generated",
  QUEUE_STATUS: "Queue Status Updated",
} as const;

// WebSocket message types sent to frontend
export interface WebSocketProgress {
  type: "job_progress";
  queueId: string;
  promptId: string;
  timestamp: string;
  status: "processing";
  progressType: "node_progress" | "overall_progress";
  progressData: {
    // Node-specific progress
    nodeId?: string;
    displayNodeId?: string;
    currentNode?: string;
    value: number;
    max: number;
    percentage: number;
    nodeState?: string;
    parentNodeId?: string;
    realNodeId?: string;
    message: string;
  };
}

export interface WebSocketJobStarted {
  type: "job_started";
  queueId: string;
  promptId: string;
  timestamp: string;
  status: "processing";
}

export interface WebSocketJobCompleted {
  type: "completed";
  queueId: string;
  promptId: string;
  timestamp: string;
  status: "completed";
  message: string;
  medias: any[]; // Media array from generation
}

export interface WebSocketJobFailed {
  type: "job_failed";
  queueId: string;
  promptId: string;
  timestamp: string;
  status: "failed";
  error: {
    type: string;
    message: string;
  };
}

export interface WebSocketJobRetry {
  type: "job_retry";
  queueId: string;
  promptId: string;
  timestamp: string;
  status: "pending";
  retryCount: number;
  retryDelay: number;
  message: string;
}

// Union type for all WebSocket messages
export type ComfyUIWebSocketMessage =
  | WebSocketProgress
  | WebSocketJobStarted
  | WebSocketJobCompleted
  | WebSocketJobFailed
  | WebSocketJobRetry;
