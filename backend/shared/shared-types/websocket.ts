// WebSocket Types
export interface WebSocketMessage {
  action: string;
  data?: any;
  requestId?: string;
}

// Optimization event data structure for WebSocket streaming
export interface OptimizationEventData {
  type:
    | "optimization_start"
    | "optimization_token" 
    | "optimization_complete"
    | "optimization_error";
  originalPrompt: string;
  optimizedPrompt: string;
  token?: string;
  completed: boolean;
  error?: string;
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
