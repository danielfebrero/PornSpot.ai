/**
 * @fileoverview ComfyUI Error Handler
 * @description Custom error types and retry handler for ComfyUI API interactions.
 * @notes
 * - ComfyUIErrorType enum for error categories.
 * - ComfyUIError class with type, statusCode, promptId, retryable, originalError.
 * - Static fromHttpError, fromWebSocketError methods.
 * - ComfyUIRetryHandler with exponential backoff.
 * - ComfyUICircuitBreaker for failure isolation.
 * - Determines retryability based on type/status.
 */
export enum ComfyUIErrorType {
  CONNECTION_FAILED = "CONNECTION_FAILED",
  TIMEOUT = "TIMEOUT",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  GENERATION_FAILED = "GENERATION_FAILED",
  QUEUE_FULL = "QUEUE_FULL",
  INVALID_WORKFLOW = "INVALID_WORKFLOW",
  SERVER_ERROR = "SERVER_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  WEBSOCKET_ERROR = "WEBSOCKET_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class ComfyUIError extends Error {
  public readonly type: ComfyUIErrorType;
  public readonly statusCode?: number;
  public readonly promptId?: string;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(
    type: ComfyUIErrorType,
    message: string,
    options: {
      statusCode?: number;
      promptId?: string;
      retryable?: boolean;
      originalError?: Error;
    } = {}
  ) {
    super(message);
    this.name = "ComfyUIError";
    this.type = type;
    this.statusCode = options.statusCode;
    this.promptId = options.promptId;
    this.retryable =
      options.retryable ?? this.determineRetryable(type, options.statusCode);
    this.originalError = options.originalError;
  }

  private determineRetryable(
    type: ComfyUIErrorType,
    statusCode?: number
  ): boolean {
    // Determine if an error is retryable based on type and status code
    switch (type) {
      case ComfyUIErrorType.CONNECTION_FAILED:
      case ComfyUIErrorType.TIMEOUT:
      case ComfyUIErrorType.NETWORK_ERROR:
      case ComfyUIErrorType.WEBSOCKET_ERROR:
        return true;

      case ComfyUIErrorType.SERVER_ERROR:
        return statusCode ? statusCode >= 500 : true;

      case ComfyUIErrorType.QUEUE_FULL:
        return true; // Can retry after some time

      case ComfyUIErrorType.INVALID_WORKFLOW:
      case ComfyUIErrorType.INVALID_RESPONSE:
        return false; // These won't be fixed by retrying

      case ComfyUIErrorType.GENERATION_FAILED:
        return false; // Generation failures are usually due to bad parameters

      default:
        return false;
    }
  }

  static fromHttpError(error: any, promptId?: string): ComfyUIError {
    if (error.name === "AbortError") {
      return new ComfyUIError(ComfyUIErrorType.TIMEOUT, "Request timed out", {
        promptId,
        originalError: error,
      });
    }

    if (
      error.cause?.code === "ECONNREFUSED" ||
      error.cause?.code === "ENOTFOUND"
    ) {
      return new ComfyUIError(
        ComfyUIErrorType.CONNECTION_FAILED,
        "Failed to connect to ComfyUI server",
        { promptId, originalError: error }
      );
    }

    if (error.response) {
      const statusCode = error.response.status;
      if (statusCode >= 500) {
        return new ComfyUIError(
          ComfyUIErrorType.SERVER_ERROR,
          `ComfyUI server error: ${statusCode}`,
          { statusCode, promptId, originalError: error }
        );
      } else if (statusCode === 429) {
        return new ComfyUIError(
          ComfyUIErrorType.QUEUE_FULL,
          "ComfyUI queue is full",
          { statusCode, promptId, originalError: error }
        );
      } else if (statusCode >= 400) {
        return new ComfyUIError(
          ComfyUIErrorType.INVALID_WORKFLOW,
          `Invalid request: ${statusCode}`,
          { statusCode, promptId, originalError: error }
        );
      }
    }

    return new ComfyUIError(
      ComfyUIErrorType.NETWORK_ERROR,
      error.message || "Network error occurred",
      { promptId, originalError: error }
    );
  }

  static fromWebSocketError(error: any, promptId?: string): ComfyUIError {
    return new ComfyUIError(
      ComfyUIErrorType.WEBSOCKET_ERROR,
      `WebSocket error: ${error.message || "Unknown WebSocket error"}`,
      { promptId, originalError: error }
    );
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export class ComfyUIRetryHandler {
  private static defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    timeoutMs: 30000, // 30 seconds
  };

  public static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: { promptId?: string; operationName?: string } = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: ComfyUIError | undefined;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        // Add timeout to the operation
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new ComfyUIError(
                ComfyUIErrorType.TIMEOUT,
                `Operation timed out after ${finalConfig.timeoutMs}ms`,
                { promptId: context.promptId }
              )
            );
          }, finalConfig.timeoutMs);
        });

        const result = await Promise.race([operation(), timeoutPromise]);

        // If we get here, the operation succeeded
        if (attempt > 0) {
          console.log(
            `✅ Operation ${
              context.operationName || "unknown"
            } succeeded after ${attempt} retries`
          );
        }

        return result;
      } catch (error) {
        // Convert to ComfyUIError if not already
        const comfyError =
          error instanceof ComfyUIError
            ? error
            : ComfyUIError.fromHttpError(error, context.promptId);

        lastError = comfyError;

        // Log the error
        console.error(
          `❌ Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} failed for ${
            context.operationName || "operation"
          }:`,
          comfyError.message
        );

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === finalConfig.maxRetries || !comfyError.retryable) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay *
            Math.pow(finalConfig.backoffMultiplier, attempt),
          finalConfig.maxDelay
        );

        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw (
      lastError ||
      new ComfyUIError(
        ComfyUIErrorType.UNKNOWN_ERROR,
        "Retry operation failed with unknown error",
        { promptId: context.promptId }
      )
    );
  }
}

export class ComfyUICircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs = 60000, // 1 minute
    private readonly successThreshold = 2
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    operationName = "unknown"
  ): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = "HALF_OPEN";
        console.log(
          `🔄 Circuit breaker for ${operationName} moved to HALF_OPEN`
        );
      } else {
        throw new ComfyUIError(
          ComfyUIErrorType.CONNECTION_FAILED,
          `Circuit breaker is OPEN for ${operationName}. Service is temporarily unavailable.`,
          { retryable: false }
        );
      }
    }

    try {
      const result = await operation();

      // Success - reset failure count and close circuit if needed
      if (this.state === "HALF_OPEN") {
        this.failureCount = Math.max(0, this.failureCount - 1);
        if (this.failureCount < this.successThreshold) {
          this.state = "CLOSED";
          console.log(
            `✅ Circuit breaker for ${operationName} moved to CLOSED`
          );
        }
      } else {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
        console.error(
          `🚨 Circuit breaker for ${operationName} moved to OPEN after ${this.failureCount} failures`
        );
      }

      throw error;
    }
  }

  getState(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
