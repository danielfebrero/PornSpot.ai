export interface WebSocketMessage {
  type:
    | "queued"
    | "processing"
    | "progress"
    | "completed"
    | "error"
    | "retrying"
    | "ping";
  queueId?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  progress?: number;
  maxProgress?: number;
  message?: string;
  currentNode?: string;
  images?: any[];
  error?: string;
  errorType?: string;
  retryCount?: number;
}

export interface GenerationQueueStatus {
  queueId: string;
  queuePosition: number;
  estimatedWaitTime: number;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  images?: any[];
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
