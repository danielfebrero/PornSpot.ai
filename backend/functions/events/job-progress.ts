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
import { NodeProgressEvent } from "@shared/shared-types/comfyui-events";

const queueService = GenerationQueueService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

export const handler = async (
  event: EventBridgeEvent<"Node Progress Update", NodeProgressEvent>,
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
      nodeTitle,
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

    // Prepare enhanced progress data with node information
    const progressData = {
      nodeId,
      displayNodeId,
      currentNode: displayNodeId,
      nodeName: formatNodeName(displayNodeId),
      value: nodeProgress,
      max: nodeMaxProgress,
      percentage: nodePercentage,
      nodeState,
      parentNodeId,
      realNodeId,
      nodeTitle: nodeTitle || displayNodeId, // Use provided title or fallback to displayNodeId
      message: formatProgressMessage(
        displayNodeId,
        nodeProgress,
        nodeMaxProgress,
        nodePercentage,
        nodeState,
        nodeTitle || displayNodeId
      ),
    };

    // Update queue entry with progress information
    await queueService.updateQueueEntry(queueEntry.queueId, {
      updatedAt: Date.now().toString(),
    });

    console.log(
      `Updated node progress for queue entry ${queueEntry.queueId}: ${displayNodeId} - ${nodePercentage}%`
    );

    // Broadcast enhanced progress update to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastProgress(queueEntry, "node_progress", progressData);
    }
  } catch (error) {
    console.error("Error handling node progress event:", error);
    throw error;
  }
};

/**
 * Format node name for better display
 */
function formatNodeName(displayNodeId: string): string {
  // Convert node IDs like "KSampler" to "K-Sampler" for better readability
  return displayNodeId
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Create intelligent progress message based on node state and progress
 */
function formatProgressMessage(
  displayNodeId: string,
  progress: number,
  maxProgress: number,
  percentage: number,
  state: string,
  nodeTitle: string
): string {
  // Create different messages based on node type and state
  if (displayNodeId.toLowerCase().includes("sampler")) {
    return `Generating image using ${nodeTitle}: ${progress}/${maxProgress} steps (${percentage}%)`;
  } else if (displayNodeId.toLowerCase().includes("load")) {
    return `Loading ${nodeTitle}: ${percentage}%`;
  } else if (displayNodeId.toLowerCase().includes("encode")) {
    return `Encoding with ${nodeTitle}: ${progress}/${maxProgress} (${percentage}%)`;
  } else if (displayNodeId.toLowerCase().includes("decode")) {
    return `Decoding with ${nodeTitle}: ${progress}/${maxProgress} (${percentage}%)`;
  } else if (displayNodeId.toLowerCase().includes("vae")) {
    return `Processing with VAE: ${progress}/${maxProgress} (${percentage}%)`;
  } else {
    return `${nodeTitle}: ${progress}/${maxProgress} (${percentage}%) - ${state}`;
  }
}

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
