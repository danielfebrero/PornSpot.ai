export interface WebSocketMessage {
  type:
    | "queued"
    | "processing"
    | "progress"
    | "job_progress"  // New enhanced progress type
    | "completed"
    | "error"
    | "retrying"
    | "queue_update"
    | "ping";
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
}

export interface GenerationQueueStatus {
  queueId: string;
  queuePosition: number;
  estimatedWaitTime: number;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  images?: any[];
  medias?: any[];
}

export interface WebSocketContextType {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribe: (
    queueId: string,
    callback: (message: WebSocketMessage) => void
  ) => void;
  unsubscribe: (queueId: string) => void;
  sendMessage: (message: any) => void;
}
