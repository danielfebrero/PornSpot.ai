/*
File objective: Lambda function to handle ComfyUI job failure events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Updates queue entry with failure status and error information
- Implements retry logic based on error type and retry count
- Broadcasts failure event to connected WebSocket clients
- Publishes retry events back to EventBridge if applicable
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";
import { EventBridge } from "aws-sdk";
import {
  ComfyUIError,
  ComfyUIErrorType,
} from "@shared/services/comfyui-error-handler";
import { JobFailedEvent } from "@shared/shared-types/comfyui-events";

const queueService = GenerationQueueService.getInstance();
const eventBridge = new EventBridge();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];
const EVENT_BUS_NAME = process.env["EVENTBRIDGE_BUS_NAME"] || "comfyui-events";

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff in milliseconds

export const handler = async (
  event: EventBridgeEvent<"Job Failed", JobFailedEvent>,
  _context: Context
): Promise<void> => {
  console.log("Received job failure event:", JSON.stringify(event, null, 2));

  try {
    const { promptId, error } = event.detail;

    if (!promptId || !error) {
      console.error(
        "Missing prompt ID or error information in job failure event"
      );
      return;
    }

    // Find queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    console.log(
      `Found queue entry ${queueEntry.queueId} for failed prompt ${promptId}`
    );

    // Create ComfyUI error from event details
    const comfyError = new ComfyUIError(
      mapErrorTypeFromEvent(error.type),
      error.message,
      {
        promptId,
        originalError: error as any,
      }
    );

    // Check if we should retry this error
    const currentRetryCount = queueEntry.retryCount || 0;
    const shouldRetry = shouldRetryError(comfyError, currentRetryCount);

    if (shouldRetry) {
      console.log(
        `Retrying queue entry ${queueEntry.queueId}, attempt ${
          currentRetryCount + 1
        }`
      );
      await handleRetry(queueEntry, comfyError, currentRetryCount);
    } else {
      console.log(
        `Final failure for queue entry ${queueEntry.queueId}, max retries exceeded`
      );
      await handleFinalFailure(queueEntry, comfyError);
    }
  } catch (error) {
    console.error("Error handling job failure event:", error);
    throw error;
  }
};

function mapErrorTypeFromEvent(eventErrorType: string): ComfyUIErrorType {
  // Map ComfyUI error types to our standardized error types
  switch (eventErrorType.toLowerCase()) {
    case "outofmemoryerror":
    case "cuda_out_of_memory":
      return ComfyUIErrorType.SERVER_ERROR; // Map to server error since no specific memory error type
    case "connectionerror":
    case "network_error":
      return ComfyUIErrorType.CONNECTION_FAILED;
    case "timeout":
    case "timeouterror":
      return ComfyUIErrorType.TIMEOUT;
    case "validation_error":
    case "invalid_input":
      return ComfyUIErrorType.INVALID_WORKFLOW;
    case "model_error":
    case "model_not_found":
      return ComfyUIErrorType.GENERATION_FAILED; // Map to generation failed
    default:
      return ComfyUIErrorType.UNKNOWN_ERROR;
  }
}

// Helper function to determine if an error should be retried
function shouldRetryError(
  error: ComfyUIError,
  currentRetryCount: number
): boolean {
  return error.retryable && currentRetryCount < MAX_RETRY_ATTEMPTS;
}

// Helper function to get retry delay with exponential backoff
function getRetryDelay(retryCount: number): number {
  if (retryCount <= 0 || retryCount > RETRY_DELAYS.length) {
    return RETRY_DELAYS[RETRY_DELAYS.length - 1] || 4000; // Use max delay with fallback
  }
  return RETRY_DELAYS[retryCount - 1] || 1000; // Fallback to 1 second
}

async function handleRetry(
  queueEntry: QueueEntry,
  error: ComfyUIError,
  currentRetryCount: number
): Promise<void> {
  try {
    const nextRetryCount = currentRetryCount + 1;
    const retryDelay = getRetryDelay(nextRetryCount);

    // Update queue entry with retry information
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "pending", // Reset to pending for retry
      retryCount: nextRetryCount,
      errorType: error.type,
      lastErrorMessage: error.message,
      updatedAt: Date.now().toString(),
    });

    console.log(
      `Updated queue entry ${queueEntry.queueId} for retry ${nextRetryCount} with delay ${retryDelay}ms`
    );

    // Schedule retry by publishing queue submission event with delay
    await scheduleRetry(queueEntry.queueId, retryDelay, nextRetryCount);

    // Broadcast retry event to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastRetry(queueEntry, nextRetryCount, retryDelay);
    }
  } catch (retryError) {
    console.error("Error handling retry:", retryError);
    // If retry scheduling fails, mark as final failure
    await handleFinalFailure(queueEntry, error);
  }
}

async function handleFinalFailure(
  queueEntry: QueueEntry,
  error: ComfyUIError
): Promise<void> {
  try {
    // Update queue entry with final failure status
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "failed",
      errorMessage: error.message,
      errorType: error.type,
      completedAt: Date.now().toString(),
    });

    console.log(`Updated queue entry ${queueEntry.queueId} status to failed`);

    // Broadcast failure to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastFailure(queueEntry, error);
    }
  } catch (failureError) {
    console.error("Error handling final failure:", failureError);
    throw failureError;
  }
}

async function scheduleRetry(
  queueId: string,
  _delayMs: number, // Prefixed with underscore to indicate it's not used
  retryCount: number
): Promise<void> {
  try {
    // For immediate retry (delayMs = 0), publish event now
    // For delayed retry, we would need a scheduled EventBridge rule or Step Functions
    // For simplicity, we'll publish immediately and let the submission handler deal with rate limiting

    await eventBridge
      .putEvents({
        Entries: [
          {
            Source: "comfyui.retry",
            DetailType: "Queue Item Retry",
            Detail: JSON.stringify({
              queueId,
              retryCount,
              priority: 500, // Higher priority for retries
            }),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      })
      .promise();

    console.log(
      `Scheduled retry for queue ID ${queueId}, attempt ${retryCount}`
    );
  } catch (error) {
    console.error("Failed to schedule retry:", error);
    throw error;
  }
}

async function broadcastRetry(
  queueEntry: QueueEntry,
  retryCount: number,
  retryDelay: number
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "job_retry",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount,
      retryDelay,
      message: `Retrying generation (attempt ${retryCount})`,
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `Broadcasted retry event to connection ${queueEntry.connectionId}`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting retry event:", error);
    }
  }
}

async function broadcastFailure(
  queueEntry: QueueEntry,
  error: ComfyUIError
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "job_failed",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "failed",
      error: {
        type: error.type,
        message: error.message,
      },
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `Broadcasted failure event to connection ${queueEntry.connectionId}`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting failure event:", error);
    }
  }
}
