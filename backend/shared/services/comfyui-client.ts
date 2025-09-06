/**
 * @fileoverview ComfyUI Client Service
 * @description Handles HTTP API calls and WebSocket connections to ComfyUI for AI image generation.
 * @notes
 * - Manages prompt submission, queue status, history retrieval, image downloads.
 * - Uses connection pool for WebSocket updates.
 * - Includes circuit breaker and retry handler for reliability.
 * - Parses messages for progress, execution, and completion events.
 * - Supports system stats and interruption.
 * - EventEmitter for error events.
 * - Interfaces for messages, progress, queue items.
 */

import * as WebSocket from "ws";
import { EventEmitter } from "events";
import {
  ComfyUIConnectionPool,
  getConnectionPool,
  ComfyUIConnection,
} from "./comfyui-connection-pool";
import {
  createComfyUIWorkflow,
  createPromptRequest,
  WorkflowParameters,
  ComfyUIWorkflow,
} from "../templates/comfyui-workflow";
import {
  ComfyUIError,
  ComfyUIErrorType,
  ComfyUIRetryHandler,
  ComfyUICircuitBreaker,
  RetryConfig,
} from "./comfyui-error-handler";

export interface ComfyUIPromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, any>;
}

export interface ComfyUIMessage {
  type:
    | "status"
    | "progress"
    | "progress_state"
    | "executing"
    | "execution_start"
    | "execution_cached"
    | "executed";
  data: ComfyUIMessageData;
}

export interface ComfyUIMessageData {
  // Status message data
  status?: {
    exec_info?: {
      queue_remaining: number;
    };
  };

  // Progress message data
  value?: number;
  max?: number;
  node?: string | null;

  // Progress state message data (enhanced progress tracking)
  nodes?: {
    [nodeId: string]: {
      value: number;
      max: number;
      state: string;
      node_id: string;
      prompt_id: string;
      display_node_id: string;
      parent_node_id: string | null;
      real_node_id: string;
    };
  };

  // Executing message data
  prompt_id?: string;

  // Executed message data
  output?: {
    images?: ComfyUIImageResult[];
    [key: string]: any;
  };

  // Allow additional properties for extensibility
  [key: string]: any;
}

export interface ComfyUIImageResult {
  filename: string;
  subfolder: string;
  type: "output" | "temp" | "input";
}

export interface ComfyUISystemStats {
  system: {
    os: string;
    python_version: string;
    embedded_python?: boolean;
  };
  devices?: Array<{
    name: string;
    type: string;
    index?: number;
    vram_total?: number;
    vram_free?: number;
    torch_vram_total?: number;
    torch_vram_free?: number;
  }>;
  [key: string]: any; // Allow for additional properties as ComfyUI may extend this
}

export interface ComfyUIQueueItem {
  priority: number;
  prompt_id: string;
  prompt_object: ComfyUIWorkflow;
  client_id: string;
  extra_data: Record<string, any>;
}

export interface ComfyUIHistoryResult {
  prompt: [
    string, // prompt_id
    number, // timestamp
    string, // client_id
    ComfyUIWorkflow, // workflow object
    Record<string, any>, // extra_data
    Record<string, boolean> // output_node_ids (which nodes to save outputs from)
  ];
  outputs: Record<
    string,
    {
      images?: ComfyUIImageResult[];
      [key: string]: any;
    }
  >;
  status: {
    completed: boolean;
    messages: string[];
    error: boolean;
  };
}

export interface GenerationProgress {
  promptId: string;
  status: "queued" | "executing" | "completed" | "error";
  progress?: number;
  maxProgress?: number;
  currentNode?: string;
  message?: string;
  images?: ComfyUIImageResult[];
  error?: string;
}

/**
 * ComfyUI client service for API interactions and WebSocket management
 */
export class ComfyUIClientService extends EventEmitter {
  private baseUrl: string;
  private connectionPool: ComfyUIConnectionPool;
  private activeConnections: Map<string, ComfyUIConnection> = new Map();
  private circuitBreaker: ComfyUICircuitBreaker;
  private retryConfig: RetryConfig;

  constructor(baseUrl: string, retryConfig?: Partial<RetryConfig>) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.connectionPool = getConnectionPool(baseUrl);
    this.circuitBreaker = new ComfyUICircuitBreaker();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      timeoutMs: 30000,
      ...retryConfig,
    };

    // Set up connection pool event handlers
    this.connectionPool.on("connection-error", (connectionId, error) => {
      console.error(`Connection pool error for ${connectionId}:`, error);
      this.emit("error", error);
    });
  }

  /**
   * Submits a prompt to ComfyUI for generation
   */
  async submitPrompt(
    parameters: WorkflowParameters,
    clientId: string
  ): Promise<{ promptId: string; response: ComfyUIPromptResponse }> {
    return await this.circuitBreaker.execute(async () => {
      return await ComfyUIRetryHandler.withRetry(
        async () => {
          try {
            // Create workflow from parameters
            const workflow = createComfyUIWorkflow(parameters);
            const promptRequest = createPromptRequest(workflow, clientId);

            // Submit to ComfyUI with AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              this.retryConfig.timeoutMs
            );

            console.log(
              "submiting prompt: ",
              JSON.stringify({ workflow, promptRequest })
            );

            const response = await fetch(`${this.baseUrl}/prompt`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(promptRequest),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();

              if (response.status >= 500) {
                throw new ComfyUIError(
                  ComfyUIErrorType.SERVER_ERROR,
                  `ComfyUI server error: ${response.status} - ${errorText}`,
                  { statusCode: response.status }
                );
              } else if (response.status === 429) {
                throw new ComfyUIError(
                  ComfyUIErrorType.QUEUE_FULL,
                  `ComfyUI queue is full: ${errorText}`,
                  { statusCode: response.status }
                );
              } else {
                throw new ComfyUIError(
                  ComfyUIErrorType.INVALID_WORKFLOW,
                  `Invalid workflow: ${response.status} - ${errorText}`,
                  { statusCode: response.status }
                );
              }
            }

            const result = (await response.json()) as ComfyUIPromptResponse;

            // Check for node errors in the response
            if (
              result.node_errors &&
              Object.keys(result.node_errors).length > 0
            ) {
              throw new ComfyUIError(
                ComfyUIErrorType.INVALID_WORKFLOW,
                `Workflow validation failed: ${JSON.stringify(
                  result.node_errors
                )}`,
                { retryable: false }
              );
            }

            console.log(`✅ ComfyUI prompt submitted: ${result.prompt_id}`);

            return {
              promptId: result.prompt_id,
              response: result,
            };
          } catch (error) {
            if (error instanceof ComfyUIError) {
              throw error;
            }
            throw ComfyUIError.fromHttpError(error);
          }
        },
        this.retryConfig,
        { operationName: "submitPrompt" }
      );
    }, "submitPrompt");
  }

  /**
   * Establishes WebSocket connection for real-time updates
   */
  async connectForUpdates(
    promptId: string,
    clientId: string,
    onProgress: (progress: GenerationProgress) => void
  ): Promise<void> {
    return await this.circuitBreaker.execute(async () => {
      return await ComfyUIRetryHandler.withRetry(
        async () => {
          try {
            // Get connection from pool
            const connection = await this.connectionPool.getConnection(
              clientId
            );
            this.activeConnections.set(promptId, connection);

            // Set up message handlers
            connection.ws.on("message", (data: WebSocket.Data) => {
              try {
                const message: ComfyUIMessage = JSON.parse(data.toString());
                const progress = this.parseComfyUIMessage(message, promptId);

                if (progress) {
                  onProgress(progress);

                  // If generation is complete or errored, clean up connection
                  if (
                    progress.status === "completed" ||
                    progress.status === "error"
                  ) {
                    this.disconnectFromUpdates(promptId);
                  }
                }
              } catch (error) {
                console.error("Failed to parse ComfyUI message:", error);
                const comfyError = ComfyUIError.fromWebSocketError(
                  error,
                  promptId
                );
                onProgress({
                  promptId,
                  status: "error",
                  error: comfyError.message,
                });
              }
            });

            connection.ws.on("error", (error: Error) => {
              console.error(`WebSocket error for prompt ${promptId}:`, error);
              const comfyError = ComfyUIError.fromWebSocketError(
                error,
                promptId
              );
              onProgress({
                promptId,
                status: "error",
                error: comfyError.message,
              });
              this.disconnectFromUpdates(promptId);
            });

            connection.ws.on("close", (code: number, reason: Buffer) => {
              console.log(
                `WebSocket closed for prompt ${promptId}: ${code} ${reason.toString()}`
              );

              // Only report as error if it's an unexpected close
              if (code !== 1000 && code !== 1001) {
                const comfyError = new ComfyUIError(
                  ComfyUIErrorType.WEBSOCKET_ERROR,
                  `WebSocket closed unexpectedly: ${code} ${reason.toString()}`,
                  { promptId }
                );
                onProgress({
                  promptId,
                  status: "error",
                  error: comfyError.message,
                });
              }

              this.disconnectFromUpdates(promptId);
            });

            console.log(
              `🔗 Connected to ComfyUI WebSocket for prompt: ${promptId}`
            );
          } catch (error) {
            if (error instanceof ComfyUIError) {
              throw error;
            }
            throw ComfyUIError.fromWebSocketError(error, promptId);
          }
        },
        {
          maxRetries: 2, // Fewer retries for WebSocket connections
          timeoutMs: 10000, // Shorter timeout
        },
        { promptId, operationName: "connectForUpdates" }
      );
    }, "connectForUpdates");
  }

  /**
   * Disconnects from WebSocket updates for a specific prompt
   */
  disconnectFromUpdates(promptId: string): void {
    const connection = this.activeConnections.get(promptId);
    if (connection) {
      this.connectionPool.releaseConnection(connection.id);
      this.activeConnections.delete(promptId);
      console.log(`🔌 Disconnected from updates for prompt: ${promptId}`);
    }
  }

  /**
   * Gets the current queue status from ComfyUI
   */
  async getQueueStatus(): Promise<{
    queue_running: ComfyUIQueueItem[];
    queue_pending: ComfyUIQueueItem[];
  }> {
    return await this.circuitBreaker.execute(async () => {
      return await ComfyUIRetryHandler.withRetry(
        async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              this.retryConfig.timeoutMs
            );

            const response = await fetch(`${this.baseUrl}/queue`, {
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new ComfyUIError(
                ComfyUIErrorType.SERVER_ERROR,
                `Failed to get queue status: ${response.status}`,
                { statusCode: response.status }
              );
            }

            return (await response.json()) as {
              queue_running: ComfyUIQueueItem[];
              queue_pending: ComfyUIQueueItem[];
            };
          } catch (error) {
            if (error instanceof ComfyUIError) {
              throw error;
            }
            throw ComfyUIError.fromHttpError(error);
          }
        },
        this.retryConfig,
        { operationName: "getQueueStatus" }
      );
    }, "getQueueStatus");
  }

  /**
   * Gets the history/results for a specific prompt
   */
  async getPromptHistory(
    promptId: string
  ): Promise<ComfyUIHistoryResult | null> {
    return await this.circuitBreaker.execute(async () => {
      return await ComfyUIRetryHandler.withRetry(
        async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              this.retryConfig.timeoutMs
            );

            const response = await fetch(
              `${this.baseUrl}/history/${promptId}`,
              {
                signal: controller.signal,
              }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
              if (response.status === 404) {
                return null; // Prompt not yet in history
              }
              throw new ComfyUIError(
                ComfyUIErrorType.SERVER_ERROR,
                `Failed to get prompt history: ${response.status}`,
                { statusCode: response.status, promptId }
              );
            }

            const history = (await response.json()) as Record<
              string,
              ComfyUIHistoryResult
            >;
            return history[promptId] || null;
          } catch (error) {
            if (error instanceof ComfyUIError) {
              throw error;
            }
            throw ComfyUIError.fromHttpError(error, promptId);
          }
        },
        this.retryConfig,
        { promptId, operationName: "getPromptHistory" }
      );
    }, "getPromptHistory");
  }

  /**
   * Downloads an image from ComfyUI
   */
  async downloadImage(imageResult: ComfyUIImageResult): Promise<Buffer> {
    return await this.circuitBreaker.execute(async () => {
      return await ComfyUIRetryHandler.withRetry(
        async () => {
          try {
            const params = new URLSearchParams({
              filename: imageResult.filename,
              subfolder: imageResult.subfolder,
              type: imageResult.type,
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              this.retryConfig.timeoutMs
            );

            const response = await fetch(`${this.baseUrl}/view?${params}`, {
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new ComfyUIError(
                ComfyUIErrorType.SERVER_ERROR,
                `Failed to download image: ${response.status}`,
                { statusCode: response.status }
              );
            }

            return Buffer.from(await response.arrayBuffer());
          } catch (error) {
            if (error instanceof ComfyUIError) {
              throw error;
            }
            throw ComfyUIError.fromHttpError(error);
          }
        },
        this.retryConfig,
        { operationName: `downloadImage(${imageResult.filename})` }
      );
    }, "downloadImage");
  }

  /**
   * Gets system stats from ComfyUI
   */
  async getSystemStats(): Promise<ComfyUISystemStats> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`);

      if (!response.ok) {
        throw new Error(`Failed to get system stats: ${response.status}`);
      }

      return (await response.json()) as ComfyUISystemStats;
    } catch (error) {
      console.error("Failed to get ComfyUI system stats:", error);
      throw error;
    }
  }

  /**
   * Interrupts the current execution
   */
  async interruptExecution(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/interrupt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to interrupt execution: ${response.status}`);
      }

      console.log("🛑 ComfyUI execution interrupted");
    } catch (error) {
      console.error("Failed to interrupt ComfyUI execution:", error);
      throw error;
    }
  }

  /**
   * Parses ComfyUI WebSocket messages into progress updates
   */
  private parseComfyUIMessage(
    message: ComfyUIMessage,
    promptId: string
  ): GenerationProgress | null {
    switch (message.type) {
      case "status":
        // Queue status update
        if (message.data?.status?.exec_info?.queue_remaining !== undefined) {
          return {
            promptId,
            status: "queued",
            message: `Queue remaining: ${message.data.status.exec_info.queue_remaining}`,
          };
        }
        break;

      case "execution_start":
        return {
          promptId,
          status: "executing",
          message: "Execution started",
        };

      case "progress":
        // Progress update during execution
        if (
          message.data?.value !== undefined &&
          message.data?.max !== undefined
        ) {
          return {
            promptId,
            status: "executing",
            progress: message.data.value,
            maxProgress: message.data.max,
            currentNode: message.data.node || undefined,
            message: `Progress: ${message.data.value}/${message.data.max}`,
          };
        }
        break;

      case "progress_state":
        // Enhanced progress update with detailed node-level state information
        // Since nodes only appear when active, report on currently running node
        if (message.data?.prompt_id === promptId && message.data?.nodes) {
          const nodes = message.data.nodes;
          const nodeEntries = Object.entries(nodes);

          if (nodeEntries.length === 0) {
            return null; // No active nodes
          }

          // Report on the first (and typically only) active node
          const firstNodeEntry = nodeEntries[0];
          if (!firstNodeEntry) {
            return null;
          }

          const [nodeId, nodeInfo] = firstNodeEntry;
          const nodePercentage =
            nodeInfo.max > 0 ? (nodeInfo.value / nodeInfo.max) * 100 : 0;

          return {
            promptId,
            status: "executing",
            progress: nodeInfo.value,
            maxProgress: nodeInfo.max,
            currentNode: nodeInfo.display_node_id || nodeId,
            message: `Node ${nodeInfo.display_node_id || nodeId}: ${
              nodeInfo.value
            }/${nodeInfo.max} (${nodePercentage.toFixed(1)}%) - ${
              nodeInfo.state
            }`,
          };
        }
        break;

      case "executing":
        // Node execution update
        if (message.data?.prompt_id === promptId) {
          if (message.data.node === null) {
            // Execution completed
            return {
              promptId,
              status: "completed",
              message: "Generation completed",
            };
          } else {
            // Node started executing
            const nodeId = message.data.node || "unknown";
            return {
              promptId,
              status: "executing",
              currentNode: nodeId,
              message: `Executing node: ${nodeId}`,
            };
          }
        }
        break;

      case "executed":
        // Node execution completed with outputs
        if (
          message.data?.prompt_id === promptId &&
          message.data?.output?.images
        ) {
          return {
            promptId,
            status: "executing",
            images: message.data.output.images,
            message: "Preview images available",
          };
        }
        break;

      default:
        // Unknown message type
        break;
    }

    return null;
  }

  /**
   * Checks if ComfyUI is healthy and responsive
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Shorter timeout for health checks

      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: controller.signal,
      });

      console.log(JSON.stringify(response, null, 2));

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error("ComfyUI health check failed:", error);
      return false;
    }
  }

  /**
   * Cleans up all active connections
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up ComfyUI client connections...");

    // Disconnect all active connections
    for (const promptId of this.activeConnections.keys()) {
      this.disconnectFromUpdates(promptId);
    }

    // Shutdown connection pool
    await this.connectionPool.shutdown();
  }

  /**
   * Gets connection pool statistics
   */
  getConnectionStats() {
    return {
      pool: this.connectionPool.getStats(),
      activeConnections: this.activeConnections.size,
      circuitBreaker: this.circuitBreaker.getState(),
    };
  }
}

/**
 * Global ComfyUI client instance
 */
let globalComfyUIClient: ComfyUIClientService | null = null;

/**
 * Gets or creates the global ComfyUI client instance
 */
export function getComfyUIClient(baseUrl?: string): ComfyUIClientService {
  if (!globalComfyUIClient && baseUrl) {
    globalComfyUIClient = new ComfyUIClientService(baseUrl);
  }

  if (!globalComfyUIClient) {
    throw new Error("ComfyUI client not initialized. Call with baseUrl first.");
  }

  return globalComfyUIClient;
}

/**
 * Initializes the global ComfyUI client
 */
export function initializeComfyUIClient(baseUrl: string): ComfyUIClientService {
  if (globalComfyUIClient) {
    throw new Error("ComfyUI client already initialized");
  }

  globalComfyUIClient = new ComfyUIClientService(baseUrl);
  return globalComfyUIClient;
}

/**
 * Shuts down the global ComfyUI client
 */
export async function shutdownComfyUIClient(): Promise<void> {
  if (globalComfyUIClient) {
    await globalComfyUIClient.cleanup();
    globalComfyUIClient = null;
  }
}
