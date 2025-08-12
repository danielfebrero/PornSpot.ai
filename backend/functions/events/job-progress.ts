/*
File objective: Lambda function to handle ComfyUI job progress events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Updates queue entry with progress information
- Broadcasts progress updates to connected WebSocket clients
- Handles real-time progress tracking for frontend
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";

interface JobProgressEventDetail {
  promptId: string;
  timestamp: string;
  executionCached?: {
    promptId: string;
    nodes: string[];
  };
  executing?: {
    promptId: string;
    node: string;
  };
  progress?: {
    promptId: string;
    node: string;
    value: number;
    max: number;
  };
}

const queueService = GenerationQueueService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

export const handler = async (
  event: EventBridgeEvent<"ComfyUI Job Progress", JobProgressEventDetail>,
  _context: Context
): Promise<void> => {
  console.log("Received job progress event:", JSON.stringify(event, null, 2));

  try {
    const { promptId, executionCached, executing, progress } = event.detail;

    if (!promptId) {
      console.error("No prompt ID in job progress event");
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

    // Determine progress information
    let progressData: any = {};
    let progressType = "unknown";

    if (executionCached) {
      progressType = "cached";
      progressData = {
        cachedNodes: executionCached.nodes,
        message: `Cached execution for ${executionCached.nodes.length} nodes`,
      };
    } else if (executing) {
      progressType = "executing";
      progressData = {
        currentNode: executing.node,
        message: `Executing node: ${executing.node}`,
      };
    } else if (progress) {
      progressType = "progress";
      const percentage =
        progress.max > 0
          ? Math.round((progress.value / progress.max) * 100)
          : 0;
      progressData = {
        currentNode: progress.node,
        value: progress.value,
        max: progress.max,
        percentage,
        message: `Processing ${progress.node}: ${percentage}%`,
      };
    }

    // Update queue entry with progress information
    await queueService.updateQueueEntry(queueEntry.queueId, {
      updatedAt: Date.now().toString(),
    });

    console.log(
      `Updated progress for queue entry ${queueEntry.queueId}: ${progressType}`
    );

    // Broadcast progress update to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastProgress(queueEntry, progressType, progressData);
    }
  } catch (error) {
    console.error("Error handling job progress event:", error);
    throw error;
  }
};

async function broadcastProgress(
  queueEntry: QueueEntry,
  progressType: string,
  progressData: any
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "job_progress",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "processing",
      progressType,
      progressData,
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `Broadcasted progress update to connection ${queueEntry.connectionId}: ${progressType}`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting progress update:", error);
    }
  }
}
