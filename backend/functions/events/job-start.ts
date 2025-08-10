/*
File objective: Lambda function to handle ComfyUI job start events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Updates queue entry status when ComfyUI starts processing
- Broadcasts start event to connected WebSocket clients
- Handles mapping from ComfyUI prompt ID to queue ID
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";

interface JobStartEventDetail {
  promptId: string;
  timestamp: string;
  executionStart: {
    promptId: string;
  };
}

const queueService = GenerationQueueService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

export const handler = async (
  event: EventBridgeEvent<"ComfyUI Job Start", JobStartEventDetail>,
  _context: Context
): Promise<void> => {
  console.log("Received job start event:", JSON.stringify(event, null, 2));

  try {
    const { promptId } = event.detail;

    if (!promptId) {
      console.error("No prompt ID in job start event");
      return;
    }

    // Find queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    console.log(
      `Found queue entry ${queueEntry.queueId} for prompt ${promptId}`
    );

    // Update queue entry status to indicate job has started
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "processing",
      startedAt: Date.now(),
    });

    console.log(
      `Updated queue entry ${queueEntry.queueId} status to processing`
    );

    // Broadcast job start to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastJobStart(queueEntry);
    }
  } catch (error) {
    console.error("Error handling job start event:", error);
    throw error;
  }
};

async function broadcastJobStart(queueEntry: QueueEntry): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "job_started",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "processing",
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `Broadcasted job start to connection ${queueEntry.connectionId}`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting job start:", error);
    }
  }
}
