/*
File objective: Lambda function to handle ComfyUI workflow nodes events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Handles "Workflow Nodes" events from ComfyUI monitor
- Updates queue entry with sorted workflow node information
- Broadcasts workflow nodes to connected WebSocket clients for frontend state management
- Enables intelligent progress tracking based on workflow execution order
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";

const queueService = GenerationQueueService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

interface WorkflowNode {
  nodeId: string;
  classType: string;
  nodeTitle: string;
  dependencies: string[];
}

interface WorkflowNodesEvent {
  promptId: string;
  timestamp: string;
  clientId: string;
  workflowNodes: WorkflowNode[];
  totalNodes: number;
}

export const handler = async (
  event: EventBridgeEvent<"Workflow Nodes", WorkflowNodesEvent>,
  _context: Context
): Promise<void> => {
  console.log("Received workflow nodes event:", JSON.stringify(event, null, 2));

  try {
    const { promptId, workflowNodes, totalNodes } = event.detail;

    if (!promptId) {
      console.error("No prompt ID in workflow nodes event");
      return;
    }

    if (!workflowNodes || workflowNodes.length === 0) {
      console.warn(`No workflow nodes provided for prompt ID: ${promptId}`);
      return;
    }

    // Find queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    console.log(
      `Found queue entry ${queueEntry.queueId} for prompt ${promptId} - Processing ${totalNodes} workflow nodes`
    );

    // Create workflow data for storage and frontend
    const workflowData = {
      nodes: workflowNodes,
      totalNodes,
      currentNodeIndex: 0, // Start at first node
      nodeOrder: workflowNodes.map((node) => node.nodeId),
    };

    // Update queue entry with workflow information
    await queueService.updateQueueEntry(queueEntry.queueId, {
      workflowData: JSON.stringify(workflowData),
      updatedAt: Date.now().toString(),
    });

    console.log(
      `Updated queue entry ${queueEntry.queueId} with workflow data: ${workflowNodes.map((n) => `${n.nodeId}(${n.nodeTitle})`).join(" → ")}`
    );

    // Broadcast workflow nodes to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastWorkflowNodes(queueEntry, workflowData);
    }
  } catch (error) {
    console.error("Error handling workflow nodes event:", error);
    throw error;
  }
};

async function broadcastWorkflowNodes(
  queueEntry: QueueEntry,
  workflowData: any
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "workflow_nodes",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      workflowData,
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `Broadcasted workflow nodes to connection ${queueEntry.connectionId}: ${workflowData.totalNodes} nodes`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting workflow nodes:", error);
    }
  }
}