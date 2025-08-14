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

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<
    Map<string, (message: GenerationWebSocketMessage) => void>
  >(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Helper function to get session cookie
  const getSessionCookie = useCallback(() => {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split(";");
    const userSessionCookie = cookies.find((cookie) =>
      cookie.trim().startsWith("user_session=")
    );

    if (userSessionCookie) {
      return userSessionCookie.split("=")[1];
    }

    return null;
  }, []);

  const getWebSocketUrl = useCallback(() => {
    // In production, this would come from environment variables
    // For now, we'll use a placeholder that should be replaced with actual CloudFormation output
    let wsUrl =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL ||
      process.env.NEXT_PUBLIC_WEBSOCKET_API_URL ||
      "wss://your-websocket-api-id.execute-api.region.amazonaws.com/stage";

    // Add session cookie as query parameter if available
    const sessionToken = getSessionCookie();
    if (sessionToken) {
      const separator = wsUrl.includes("?") ? "&" : "?";
      wsUrl += `${separator}sessionToken=${encodeURIComponent(sessionToken)}`;
      console.log("🍪 Added session token to WebSocket URL");
    } else {
      console.log("🔓 No session token found, connecting as anonymous");
    }

    console.log(
      "WebSocket URL:",
      wsUrl.replace(/sessionToken=[^&]+/, "sessionToken=***")
    );
    return wsUrl;
  }, [getSessionCookie]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = getWebSocketUrl();
      console.log("🔌 Connecting to WebSocket:", wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("✅ WebSocket connected");
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
          console.log("📨 WebSocket message received:", message);

          // Handle ping messages
          if (message.type === "ping") {
            // Send pong response
            wsRef.current?.send(JSON.stringify({ action: "pong" }));
            return;
          }

          // Route message to appropriate subscriber
          if (message.queueId) {
            const callback = subscriptionsRef.current.get(message.queueId);
            if (callback) {
              callback(message);
            }
          }
        } catch (error) {
          console.error("❌ Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("🔌 WebSocket disconnected:", event.code, event.reason);
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

          console.log(
            `🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`
          );
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
    console.log("🔌 Manually disconnecting WebSocket");

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  const subscribe = useCallback(
    (
      queueId: string,
      callback: (message: GenerationWebSocketMessage) => void
    ) => {
      console.log("📝 Subscribing to queue updates:", queueId);
      subscriptionsRef.current.set(queueId, callback);

      // Send subscription message to backend
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "subscribe",
            data: {
              queueId: queueId,
            },
          })
        );
      }
    },
    []
  );

  const unsubscribe = useCallback((queueId: string) => {
    console.log("📝 Unsubscribing from queue updates:", queueId);
    subscriptionsRef.current.delete(queueId);

    // Send unsubscribe message to backend
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "unsubscribe",
          data: {
            queueId: queueId,
          },
        })
      );
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
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
