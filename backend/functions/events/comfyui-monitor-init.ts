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
import { MonitorInitializedEvent } from "@shared/shared-types/comfyui-events";

export const handler = async (
  event: EventBridgeEvent<"Monitor Initialized", MonitorInitializedEvent>,
  _context: Context
): Promise<void> => {
  console.log("Received monitor init event:", JSON.stringify(event, null, 2));

  try {
    const { clientId, comfyuiHost, version } = event.detail;

    if (!clientId) {
      console.error("No clientId in monitor init event");
      return;
    }

    console.log(`📡 Storing ComfyUI monitor clientId: ${clientId}`);

    // Store the monitor client_id in DynamoDB with standardized property names
    await DynamoDBService.storeComfyUIMonitorClientId(clientId, {
      comfyui_host: comfyuiHost,
      version,
      lastConnectedAt: new Date().toISOString(),
    });

    console.log(
      `✅ ComfyUI monitor clientId stored successfully: ${clientId}`
    );
  } catch (error) {
    console.error("Error handling monitor init event:", error);
    throw error;
  }
};
