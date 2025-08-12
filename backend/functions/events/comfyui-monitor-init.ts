/*
File objective: Lambda function to handle ComfyUI monitor initialization events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Stores the monitor's client_id in DynamoDB when the monitor starts up
- Enables backend to use the correct client_id when submitting prompts to ComfyUI
- Handles monitor reconnection scenarios by updating existing records
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";

interface MonitorInitEventDetail {
  client_id: string;
  timestamp: string;
  comfyui_host: string;
  version: string;
}

export const handler = async (
  event: EventBridgeEvent<"Monitor Initialized", MonitorInitEventDetail>,
  _context: Context
): Promise<void> => {
  console.log("Received monitor init event:", JSON.stringify(event, null, 2));

  try {
    const { client_id, comfyui_host, version } = event.detail;

    if (!client_id) {
      console.error("No client_id in monitor init event");
      return;
    }

    console.log(`📡 Storing ComfyUI monitor client_id: ${client_id}`);

    // Store the monitor client_id in DynamoDB
    await DynamoDBService.storeComfyUIMonitorClientId(client_id, {
      comfyui_host,
      version,
      lastConnectedAt: new Date().toISOString(),
    });

    console.log(
      `✅ ComfyUI monitor client_id stored successfully: ${client_id}`
    );
  } catch (error) {
    console.error("Error handling monitor init event:", error);
    throw error;
  }
};
