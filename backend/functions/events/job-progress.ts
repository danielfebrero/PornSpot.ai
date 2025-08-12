/*
File objective: Lambda function to handle ComfyUI node progress events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Handles "Node Progress Update" events from ComfyUI monitor
- Updates queue entry with detailed node-level progress information
- Broadcasts progress updates to connected WebSocket clients
- Provides real-time progress tracking with enhanced node details
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";

interface NodeProgressEventDetail {
  promptId: string;
  nodeId: string;
  displayNodeId: string;
  nodeProgress: number;
  nodeMaxProgress: number;
  nodePercentage: number;
  nodeState: string;
  parentNodeId?: string;
  realNodeId?: string;
}

const queueService = GenerationQueueService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

export const handler = async (
  event: EventBridgeEvent<"Node Progress Update", NodeProgressEventDetail>,
  _context: Context
): Promise<void> => {
  console.log("Received node progress event:", JSON.stringify(event, null, 2));

  try {
    const {
      promptId,
      nodeId,
      displayNodeId,
      nodeProgress,
      nodeMaxProgress,
      nodePercentage,
      nodeState,
      parentNodeId,
      realNodeId,
    } = event.detail;

    if (!promptId) {
      console.error("No prompt ID in node progress event");
      return;
    }

    // Find queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    console.log(
      `Found queue entry ${queueEntry.queueId} for prompt ${promptId} - Node ${displayNodeId} progress: ${nodeProgress}/${nodeMaxProgress} (${nodePercentage}%)`
    );

    // Prepare detailed progress data
    const progressData = {
      nodeId,
      displayNodeId,
      currentNode: displayNodeId,
      value: nodeProgress,
      max: nodeMaxProgress,
      percentage: nodePercentage,
      nodeState,
      parentNodeId,
      realNodeId,
      message: `${displayNodeId}: ${nodeProgress}/${nodeMaxProgress} (${nodePercentage}%) - ${nodeState}`,
    };

    // Update queue entry with progress information
    await queueService.updateQueueEntry(queueEntry.queueId, {
      updatedAt: Date.now().toString(),
    });

    console.log(
      `Updated node progress for queue entry ${queueEntry.queueId}: ${displayNodeId} - ${nodePercentage}%`
    );

    // Broadcast progress update to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastProgress(queueEntry, "node_progress", progressData);
    }
  } catch (error) {
    console.error("Error handling node progress event:", error);
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
