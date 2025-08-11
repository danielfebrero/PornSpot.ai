/*
File objective: Lambda function to handle ComfyUI queue status events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Receives queue status updates from ComfyUI monitor
- Updates all pending queue entries with position information
- Broadcasts queue position updates to connected WebSocket clients
- Handles global queue status monitoring
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";

interface QueueStatusEventDetail {
  queue_remaining: number;
  exec_info: {
    queue_remaining: number;
  };
  timestamp: string;
  client_id: string;
}

const queueService = GenerationQueueService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

export const handler = async (
  event: EventBridgeEvent<"Queue Status Updated", QueueStatusEventDetail>,
  _context: Context
): Promise<void> => {
  console.log("Received queue status event:", JSON.stringify(event, null, 2));

  try {
    const { queue_remaining } = event.detail;

    console.log(`📊 ComfyUI queue status: ${queue_remaining} items remaining`);

    // Update queue positions for all pending entries
    await queueService.updateQueuePositions();

    // Get all pending queue entries to broadcast updates
    const pendingEntries = await queueService.getPendingQueueEntries();

    if (pendingEntries.length === 0) {
      console.log("📭 No pending entries to update");
      return;
    }

    console.log(`📋 Updating ${pendingEntries.length} pending queue entries`);

    // Broadcast queue position updates to all connected clients
    if (WEBSOCKET_ENDPOINT) {
      const broadcastPromises = pendingEntries
        .filter((entry) => entry.connectionId) // Only broadcast to connected clients
        .map((entry) => broadcastQueueUpdate(entry, queue_remaining));

      await Promise.allSettled(broadcastPromises);
    }

    console.log(`✅ Queue status update completed`);
  } catch (error) {
    console.error("Error handling queue status event:", error);
    throw error;
  }
};

async function broadcastQueueUpdate(
  queueEntry: QueueEntry,
  comfyUIQueueRemaining: number
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "queue_update",
      queueId: queueEntry.queueId,
      queuePosition: queueEntry.queuePosition || 1,
      estimatedWaitTime: queueEntry.estimatedWaitTime || 0,
      comfyUIQueueRemaining,
      timestamp: new Date().toISOString(),
      status: queueEntry.status,
      message: `Queue position: ${
        queueEntry.queuePosition || 1
      } (ComfyUI: ${comfyUIQueueRemaining} remaining)`,
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `📤 Broadcasted queue update to connection ${queueEntry.connectionId}: position ${queueEntry.queuePosition}`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting queue update:", error);
    }
  }
}
