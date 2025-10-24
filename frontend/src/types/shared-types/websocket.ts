/**
 * @fileoverview WebSocket Shared Types
 * @description Types for WebSocket messages and connections.
 * @notes
 * - WebSocketMessage for general messages.
 * - WebSocketSubscription for subscriptions.
 * - WebSocketUnsubscribe for unsubscriptions.
 * - WebSocketError for errors.
 * - WebSocketConnection for pool.
 */
import { WorkflowData } from "./generation";

// WebSocket Types
export interface WebSocketMessage {
  action: string;
  data?: any;
  requestId?: string;
  type?: string;
}

export interface GenerationWebSocketMessage {
  type:
    | "workflow"
    | "client_connectionId"
    | "subscription_confirmed"
    | "queued"
    | "processing"
    | "progress"
    | "job_progress"
    | "completed"
    | "error"
    | "retrying"
    | "queue_update"
    | "ping"
    | "optimization_start"
    | "optimization_token"
    | "optimization_complete"
    | "optimization_error"
    | "prompt-moderation"
    | "randomizing_prompt"
    | "selecting_loras"
    | "selecting_loras_complete";
  connectionId?: string; // Added connectionId to track the connection
  queueId?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  comfyUIQueueRemaining?: number;
  progress?: number;
  maxProgress?: number;
  message?: string;
  currentNode?: string;
  images?: any[];
  medias?: any[];
  error?: string;
  errorType?: string;
  retryCount?: number;

  // Enhanced progress data for job_progress type
  progressType?: "node_progress" | "overall_progress";
  progressData?: {
    nodeId?: string;
    displayNodeId?: string;
    currentNode?: string;
    nodeName?: string;
    value: number;
    max: number;
    percentage: number;
    nodeState?: string;
    parentNodeId?: string;
    realNodeId?: string;
    message: string;
  };

  // Optimization data for optimization_* types
  optimizationData?: {
    originalPrompt: string;
    optimizedPrompt: string;
    token?: string;
    completed: boolean;
  };

  // Prompt moderation data for prompt-moderation type
  status?: "refused";
  reason?: string;

  workflowData?: WorkflowData;
}

export interface ConnectionEntity {
  PK: string; // CONNECTION#{connectionId}
  SK: string; // METADATA
  GSI1PK: string; // WEBSOCKET_CONNECTIONS
  GSI1SK: string; // {userId}#{connectionId} or ANONYMOUS#{connectionId}
  GSI2PK: string; // WEBSOCKET_BY_IP
  GSI2SK: string; // {clientIp}#{connectionId}
  GSI3PK: string; // WEBSOCKET_USER_BY_IP
  GSI3SK: string; // {userId}#{clientIp}#{connectionId}
  EntityType: "WebSocketConnection";
  connectionId: string;
  userId?: string;
  clientIp: string;
  connectedAt: string;
  lastActivity: string;
  ttl: number; // TTL for automatic cleanup after 24 hours
}
