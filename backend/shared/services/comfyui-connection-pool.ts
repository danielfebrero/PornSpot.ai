/*
File objective: Connection pool manager for ComfyUI WebSocket connections
Auth: Used by generation services to maintain efficient WebSocket connections
Special notes:
- Manages pool of persistent WebSocket connections to ComfyUI
- Handles connection health checks and automatic reconnection
- Provides connection reuse to reduce overhead
- Thread-safe connection management for concurrent requests
*/

import WebSocket from "ws";
import { EventEmitter } from "events";

export interface ComfyUIConnection {
  id: string;
  ws: WebSocket;
  isAvailable: boolean;
  lastUsed: number;
  healthCheckCount: number;
  createdAt: number;
}

export interface ConnectionPoolOptions {
  maxConnections: number;
  idleTimeout: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  reconnectAttempts: number;
  reconnectDelay: number; // milliseconds
}

export interface ComfyUIConnectionPoolEvents {
  "connection-created": (connection: ComfyUIConnection) => void;
  "connection-removed": (connectionId: string) => void;
  "connection-error": (connectionId: string, error: Error) => void;
  "pool-empty": () => void;
  "pool-full": () => void;
}

/**
 * Manages a pool of WebSocket connections to ComfyUI for efficient reuse
 */
export class ComfyUIConnectionPool extends EventEmitter {
  private connections: Map<string, ComfyUIConnection> = new Map();
  private comfyUIUrl: string;
  private options: ConnectionPoolOptions;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    comfyUIUrl: string,
    options: Partial<ConnectionPoolOptions> = {}
  ) {
    super();

    this.comfyUIUrl = comfyUIUrl;
    this.options = {
      maxConnections: 5,
      idleTimeout: 300000, // 5 minutes
      healthCheckInterval: 30000, // 30 seconds
      reconnectAttempts: 3,
      reconnectDelay: 1000, // 1 second
      ...options,
    };

    this.startHealthChecks();
    this.startCleanupTimer();
  }

  /**
   * Gets an available connection from the pool or creates a new one
   */
  async getConnection(clientId: string): Promise<ComfyUIConnection> {
    // Try to find an available connection
    const availableConnection = this.findAvailableConnection();
    if (availableConnection) {
      availableConnection.isAvailable = false;
      availableConnection.lastUsed = Date.now();
      return availableConnection;
    }

    // Create new connection if pool isn't full
    if (this.connections.size < this.options.maxConnections) {
      return await this.createConnection(clientId);
    }

    // Pool is full, wait for a connection to become available
    return await this.waitForAvailableConnection(clientId);
  }

  /**
   * Releases a connection back to the pool
   */
  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.isAvailable = true;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Removes a connection from the pool
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
      this.connections.delete(connectionId);
      this.emit("connection-removed", connectionId);
    }
  }

  /**
   * Gets pool statistics
   */
  getStats() {
    const total = this.connections.size;
    const available = Array.from(this.connections.values()).filter(
      (c) => c.isAvailable
    ).length;
    const inUse = total - available;

    return {
      total,
      available,
      inUse,
      maxConnections: this.options.maxConnections,
      utilizationRate: total > 0 ? (inUse / total) * 100 : 0,
    };
  }

  /**
   * Closes all connections and cleanup
   */
  async shutdown(): Promise<void> {
    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(
      (connection) => {
        return new Promise<void>((resolve) => {
          if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.once("close", () => resolve());
            connection.ws.close();
          } else {
            resolve();
          }
        });
      }
    );

    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Converts HTTP/HTTPS URL to WebSocket URL
   */
  private convertToWebSocketUrl(httpUrl: string): string {
    if (httpUrl.startsWith("https://")) {
      return httpUrl.replace("https://", "ws://");
    } else if (httpUrl.startsWith("http://")) {
      return httpUrl.replace("http://", "ws://");
    }
    // If it's already a WebSocket URL, return as-is
    return httpUrl;
  }

  /**
   * Creates a new WebSocket connection to ComfyUI
   */
  private async createConnection(clientId: string): Promise<ComfyUIConnection> {
    const connectionId = `conn_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const webSocketBaseUrl = this.convertToWebSocketUrl(this.comfyUIUrl);
    const wsUrl = `${webSocketBaseUrl}/ws?clientId=${clientId}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let isResolved = false;

      const connection: ComfyUIConnection = {
        id: connectionId,
        ws,
        isAvailable: false,
        lastUsed: Date.now(),
        healthCheckCount: 0,
        createdAt: Date.now(),
      };

      // Connection timeout
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          ws.close();
          reject(new Error(`Connection timeout for ${wsUrl}`));
        }
      }, 10000); // 10 second timeout

      ws.on("open", () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);

          this.connections.set(connectionId, connection);
          this.setupConnectionHandlers(connection);
          this.emit("connection-created", connection);

          if (this.connections.size >= this.options.maxConnections) {
            this.emit("pool-full");
          }

          resolve(connection);
        }
      });

      ws.on("error", (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  /**
   * Sets up event handlers for a connection
   */
  private setupConnectionHandlers(connection: ComfyUIConnection): void {
    const { ws, id } = connection;

    ws.on("error", (error) => {
      console.error(`WebSocket error for connection ${id}:`, error);
      this.emit("connection-error", id, error);
      this.removeConnection(id);
    });

    ws.on("close", (code, reason) => {
      console.log(`WebSocket closed for connection ${id}: ${code} - ${reason}`);
      this.removeConnection(id);

      if (this.connections.size === 0) {
        this.emit("pool-empty");
      }
    });

    ws.on("pong", () => {
      // Connection is alive
      connection.healthCheckCount = 0;
    });
  }

  /**
   * Finds an available connection in the pool
   */
  private findAvailableConnection(): ComfyUIConnection | null {
    for (const connection of this.connections.values()) {
      if (
        connection.isAvailable &&
        connection.ws.readyState === WebSocket.OPEN
      ) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Waits for a connection to become available
   */
  private async waitForAvailableConnection(
    _clientId: string
  ): Promise<ComfyUIConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for available connection"));
      }, 30000); // 30 second timeout

      const checkForConnection = () => {
        const connection = this.findAvailableConnection();
        if (connection) {
          clearTimeout(timeout);
          connection.isAvailable = false;
          connection.lastUsed = Date.now();
          resolve(connection);
        } else {
          // Check again in 100ms
          setTimeout(checkForConnection, 100);
        }
      };

      checkForConnection();
    });
  }

  /**
   * Starts periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
  }

  /**
   * Performs health checks on all connections
   */
  private performHealthChecks(): void {
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        // Send ping to check if connection is alive
        connection.ws.ping();
        connection.healthCheckCount++;

        // Remove connection if it hasn't responded to multiple pings
        if (connection.healthCheckCount > 3) {
          console.warn(`Removing unresponsive connection ${connection.id}`);
          this.removeConnection(connection.id);
        }
      } else {
        // Remove closed connections
        this.removeConnection(connection.id);
      }
    }
  }

  /**
   * Starts periodic cleanup of idle connections
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.options.idleTimeout / 2); // Check every half the idle timeout
  }

  /**
   * Removes connections that have been idle too long
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const connection of this.connections.values()) {
      const idleTime = now - connection.lastUsed;

      if (connection.isAvailable && idleTime > this.options.idleTimeout) {
        connectionsToRemove.push(connection.id);
      }
    }

    connectionsToRemove.forEach((id) => {
      console.log(`Removing idle connection ${id}`);
      this.removeConnection(id);
    });
  }
}

/**
 * Global connection pool instance
 */
let globalConnectionPool: ComfyUIConnectionPool | null = null;

/**
 * Gets or creates the global connection pool
 */
export function getConnectionPool(comfyUIUrl?: string): ComfyUIConnectionPool {
  if (!globalConnectionPool && comfyUIUrl) {
    globalConnectionPool = new ComfyUIConnectionPool(comfyUIUrl);
  }

  if (!globalConnectionPool) {
    throw new Error(
      "Connection pool not initialized. Call with comfyUIUrl first."
    );
  }

  return globalConnectionPool;
}

/**
 * Initializes the global connection pool
 */
export function initializeConnectionPool(
  comfyUIUrl: string,
  options?: Partial<ConnectionPoolOptions>
): ComfyUIConnectionPool {
  if (globalConnectionPool) {
    throw new Error("Connection pool already initialized");
  }

  globalConnectionPool = new ComfyUIConnectionPool(comfyUIUrl, options);
  return globalConnectionPool;
}

/**
 * Shuts down the global connection pool
 */
export async function shutdownConnectionPool(): Promise<void> {
  if (globalConnectionPool) {
    await globalConnectionPool.shutdown();
    globalConnectionPool = null;
  }
}
