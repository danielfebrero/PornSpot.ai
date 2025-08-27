"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { WebSocketContextType } from "@/types/websocket";
import { GenerationWebSocketMessage } from "@/types/shared-types/websocket";
import { userApi } from "@/lib/api";
import { useUserContext } from "./UserContext";

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const globalSubscriptionsRef = useRef<
    Set<(message: GenerationWebSocketMessage) => void>
  >(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const { user } = useUserContext();

  const fetchConnectionId = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "get_client_connectionId" }));
  }, []);

  const getWebSocketUrl = useCallback(async () => {
    // In production, this would come from environment variables
    // For now, we'll use a placeholder that should be replaced with actual CloudFormation output
    let wsUrl =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL ||
      "wss://your-websocket-api-id.execute-api.region.amazonaws.com/stage";

    if (user?.userId) {
      // Generate JWT token for authenticated users before connecting
      try {
        const jwtResponse = await userApi.generateJwt();
        const jwtToken = jwtResponse.token;

        if (jwtToken) {
          const separator = wsUrl.includes("?") ? "&" : "?";
          wsUrl += `${separator}token=${jwtToken}`;
        }
      } catch (error) {
        console.error(
          "🔓 No JWT token available (user not authenticated), connecting as anonymous:",
          error
        );
      }
    }

    return wsUrl;
  }, [user?.userId]);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = await getWebSocketUrl();

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: GenerationWebSocketMessage = JSON.parse(event.data);

          // Handle ping messages
          if (message.type === "ping") {
            // Send pong response safely
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              try {
                wsRef.current.send(JSON.stringify({ action: "pong" }));
              } catch (error) {
                console.warn("⚠️ Failed to send pong response:", error);
              }
            }
            return;
          }

          if (message.type === "client_connectionId" && message.connectionId) {
            setConnectionId(message.connectionId);
          }

          // Route all messages to global subscribers (one queue per tab)
          globalSubscriptionsRef.current.forEach((callback) => {
            try {
              callback(message);
            } catch (error) {
              console.error("❌ Error in WebSocket message callback:", error);
            }
          });
        } catch (error) {
          console.error("❌ Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);

        // Attempt to reconnect if it wasn't a manual close
        if (
          event.code !== 1000 &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          ); // Exponential backoff, max 30s

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("❌ Failed to create WebSocket connection:", error);
      setIsConnected(false);
    }
  }, [getWebSocketUrl]);

  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection safely
    if (wsRef.current) {
      const ws = wsRef.current;
      // Check if WebSocket is still in a valid state before closing
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        try {
          ws.close(1000, "Manual disconnect");
        } catch (error) {
          console.warn("⚠️ Error closing WebSocket:", error);
        }
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionId(null);
    reconnectAttempts.current = 0;
  }, []);

  const subscribe = useCallback(
    (callback: (message: GenerationWebSocketMessage) => void) => {
      globalSubscriptionsRef.current.add(callback);
    },
    []
  );

  const unsubscribe = useCallback(
    (callback: (message: GenerationWebSocketMessage) => void) => {
      globalSubscriptionsRef.current.delete(callback);
    },
    []
  );

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.warn("⚠️ Failed to send WebSocket message:", error);
      }
    } else {
      console.warn("⚠️ Cannot send message: WebSocket not connected");
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Keep connection alive with periodic pings
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "ping" }));
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const contextValue: WebSocketContextType = {
    isConnected,
    connectionId,
    fetchConnectionId,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
