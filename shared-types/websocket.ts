// WebSocket Types
export interface WebSocketMessage {
  action: string;
  data?: any;
  requestId?: string;
}

export interface GenerationWebSocketMessage {
  type:
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
    | "optimization_error";
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
}

export interface ConnectionEntity {
  PK: string; // CONNECTION#{connectionId}
  SK: string; // METADATA
  GSI1PK: string; // WEBSOCKET_CONNECTIONS
  GSI1SK: string; // {userId}#{connectionId} or ANONYMOUS#{connectionId}
  EntityType: "WebSocketConnection";
  connectionId: string;
  userId?: string;
  connectedAt: string;
  lastActivity: string;
  ttl: number; // TTL for automatic cleanup after 24 hours
}
