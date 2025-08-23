import { GenerationWebSocketMessage } from "@/types/shared-types/websocket";
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
  connectionId: string | null;
  fetchConnectionId: () => void;
  connect: () => void;
  disconnect: () => void;
  subscribe: (callback: (message: GenerationWebSocketMessage) => void) => void;
  unsubscribe: (
    callback: (message: GenerationWebSocketMessage) => void
  ) => void;
  sendMessage: (message: any) => void;
}
