/*
File objective: Lambda function to submit a single queue item to ComfyUI
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Processes one queue item from DynamoDB
- Submits to ComfyUI via HTTP API
- Publishes job start event to EventBridge
- Handles errors and retry logic
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import { GenerationQueueService } from "@shared/services/generation-queue";
import { ParameterStoreService } from "@shared/utils/parameters";
import { DynamoDBService } from "@shared/utils/dynamodb";
import {
  getComfyUIClient,
  initializeComfyUIClient,
} from "@shared/services/comfyui-client";
import { WorkflowParameters } from "@shared/templates/comfyui-workflow";
import { EventBridge } from "aws-sdk";
import {
  ComfyUIError,
  ComfyUIErrorType,
  ComfyUIRetryHandler,
} from "@shared/services/comfyui-error-handler";

interface QueueSubmissionEvent {
  queueId: string;
  priority: number;
  retryCount?: number;
}

const eventBridge = new EventBridge();
const EVENT_BUS_NAME = process.env["EVENTBRIDGE_BUS_NAME"] || "comfyui-events";

async function publishEvent(eventType: string, detail: any): Promise<void> {
  try {
    await eventBridge
      .putEvents({
        Entries: [
          {
            Source: "comfyui.queue",
            DetailType: eventType,
            Detail: JSON.stringify({
              ...detail,
              timestamp: new Date().toISOString(),
            }),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      })
      .promise();

    console.log(`📤 Published event: ${eventType}`);
  } catch (error) {
    console.error(`❌ Failed to publish event ${eventType}:`, error);
    // Don't throw - event publishing failure shouldn't stop processing
  }
}

/**
 * Creates the selectedLoras array with proper structure for workflow parameters
 * @param queueItem - The queue item containing LoRA configuration
 * @returns Array of LoRA objects with id, name, and strength
 */
function createSelectedLorasArray(queueItem: any): Array<{
  id: string;
  name: string;
  strength: number;
}> {
  const selectedLoras: Array<{
    id: string;
    name: string;
    strength: number;
  }> = [];

  if (!queueItem.selectedLoras || !Array.isArray(queueItem.selectedLoras)) {
    return selectedLoras;
  }

  queueItem.selectedLoras.forEach((loraName: string, index: number) => {
    let strength = 1; // Default strength

    // Check if we have strength configuration for this LoRA
    if (queueItem.loraStrengths && queueItem.loraStrengths[loraName]) {
      const loraConfig = queueItem.loraStrengths[loraName];

      // If mode is "auto", use strength 1, otherwise use the configured value
      if (loraConfig.mode === "auto") {
        strength = 1;
      } else {
        strength = loraConfig.value || 1;
      }
    }

    selectedLoras.push({
      id: `lora_${index}`,
      name: loraName,
      strength: strength,
    });
  });

  return selectedLoras;
}

export const handler = async (
  event: EventBridgeEvent<string, QueueSubmissionEvent>,
  _context: Context
): Promise<void> => {
  console.log(
    "🚀 Queue item submission triggered:",
    JSON.stringify(event, null, 2)
  );

  const { queueId, retryCount = 0 } = event.detail;
  const queueService = GenerationQueueService.getInstance();
  let queueItem: any = null;

  try {
    const COMFYUI_ENDPOINT =
      await ParameterStoreService.getComfyUIApiEndpoint();
    // Get queue item from DynamoDB
    queueItem = await queueService.getQueueEntry(queueId);
    if (!queueItem) {
      console.error(`❌ Queue item not found: ${queueId}`);
      return;
    }

    if (queueItem.status !== "pending") {
      console.log(
        `⚠️  Queue item ${queueId} is not pending (status: ${queueItem.status})`
      );
      return;
    }

    // Mark as processing
    await queueService.updateQueueEntry(queueId, {
      status: "processing",
      startedAt: Date.now().toString(),
      retryCount,
    });

    console.log(`🎨 Processing queue item: ${queueId}`);

    // Initialize ComfyUI client
    let comfyUIClient;
    try {
      comfyUIClient = getComfyUIClient();
    } catch {
      console.log(
        `🔄 Initializing ComfyUI client with baseUrl: ${COMFYUI_ENDPOINT}`
      );
      comfyUIClient = initializeComfyUIClient(COMFYUI_ENDPOINT);
    }

    // Health check ComfyUI with retry
    const isHealthy = await ComfyUIRetryHandler.withRetry(
      () => comfyUIClient.healthCheck(),
      { maxRetries: 2, baseDelay: 2000 },
      { operationName: "healthCheck", promptId: queueId }
    );

    if (!isHealthy) {
      throw new ComfyUIError(
        ComfyUIErrorType.CONNECTION_FAILED,
        "ComfyUI service is not available after health check",
        { promptId: queueId, retryable: true }
      );
    }

    // Create workflow parameters
    const workflowParams: WorkflowParameters = {
      prompt: queueItem.prompt,
      negativePrompt: undefined,
      width: queueItem.parameters.width,
      height: queueItem.parameters.height,
      batchSize: queueItem.parameters.batch_size || 1,
      selectedLoras: createSelectedLorasArray(queueItem),
    };

    // Get the ComfyUI monitor client_id from DynamoDB
    const monitorClientId = await DynamoDBService.getComfyUIMonitorClientId();

    if (!monitorClientId) {
      throw new ComfyUIError(
        ComfyUIErrorType.CONNECTION_FAILED,
        "ComfyUI monitor client_id not found. Monitor may not be connected.",
        { promptId: queueId, retryable: true }
      );
    }

    console.log(`🔗 Using ComfyUI monitor client_id: ${monitorClientId}`);

    // Submit prompt to ComfyUI
    const submitResult = await comfyUIClient.submitPrompt(
      workflowParams,
      monitorClientId // Use monitor client_id instead of queueId
    );

    const comfyPromptId = submitResult.promptId;

    // Update queue entry with ComfyUI prompt ID
    await queueService.updateQueueEntry(queueId, {
      comfyPromptId,
      status: "processing",
    });

    console.log(
      `✅ ComfyUI submission successful: promptId=${comfyPromptId}, queueId=${queueId}`
    );

    // Publish job submission event
    await publishEvent("Job Submitted", {
      queueId,
      comfyPromptId,
      userId: queueItem.userId,
      prompt: queueItem.prompt,
      parameters: queueItem.parameters,
      priority: queueItem.priority,
    });

    // Register prompt mapping for the RunPod monitor
    // This could be done via HTTP endpoint to RunPod or stored in DynamoDB for the monitor to read
    await publishEvent("Prompt Mapping Required", {
      queueId,
      comfyPromptId,
      action: "register_mapping",
    });
  } catch (error) {
    const comfyError =
      error instanceof ComfyUIError
        ? error
        : new ComfyUIError(
            ComfyUIErrorType.UNKNOWN_ERROR,
            error instanceof Error ? error.message : "Unknown error",
            { promptId: queueId }
          );

    console.error(
      `❌ Queue submission error for ${queueId}:`,
      comfyError.message
    );

    // Determine if this should be retried
    const shouldRetry = comfyError.retryable && retryCount < 3;

    if (shouldRetry) {
      // Update queue entry for retry
      await queueService.updateQueueEntry(queueId, {
        status: "pending", // Reset to pending for retry
        retryCount: retryCount + 1,
        lastErrorMessage: comfyError.message,
        errorType: comfyError.type,
      });

      console.log(
        `🔄 Queue item ${queueId} will be retried (attempt ${retryCount + 1}/3)`
      );

      // Publish retry event (which will trigger this function again)
      await publishEvent("Queue Item Retry Required", {
        queueId,
        retryCount: retryCount + 1,
        error: comfyError.message,
        errorType: comfyError.type,
      });
    } else {
      // Mark as permanently failed
      await queueService.updateQueueEntry(queueId, {
        status: "failed",
        completedAt: Date.now().toString(),
        errorMessage: comfyError.message,
        errorType: comfyError.type,
      });

      // Publish failure event
      await publishEvent("Job Submission Failed", {
        queueId,
        userId: queueItem.userId,
        error: comfyError.message,
        errorType: comfyError.type,
        retryCount,
        finalFailure: true,
      });

      console.error(
        `💀 Queue item ${queueId} permanently failed after ${retryCount} retries`
      );
    }
  }
};
