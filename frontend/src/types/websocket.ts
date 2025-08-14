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
  connect: () => void;
  disconnect: () => void;
  subscribe: (
    queueId: string,
    callback: (message: GenerationWebSocketMessage) => void
  ) => void;
  unsubscribe: (queueId: string) => void;
  sendMessage: (message: any) => void;
}
