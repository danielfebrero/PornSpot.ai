/*
File objective: Handle WebSocket message routing and subscription management
Auth: Connection-based (validates connection exists)
Special notes:
- Routes different message types (subscribe, unsubscribe, etc.)
- Manages subscriptions to generation updates by queueId
- Sends responses back through WebSocket connection
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GenerationQueueService } from "@shared/services/generation-queue";
import { WebSocketMessage } from "@shared/shared-types/websocket";

// Removed SubscriptionEntity interface - using queue entry connectionId instead

// Initialize DynamoDB client
const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
const clientConfig: any = {};

if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;
const queueService = GenerationQueueService.getInstance();

// Initialize API Gateway Management API client
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env["WEBSOCKET_API_ENDPOINT"],
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("📨 WebSocket route event:", JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      console.error("❌ No connection ID provided");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No connection ID" }),
      };
    }

    // Parse message body
    let message: WebSocketMessage;
    try {
      message = JSON.parse(event.body || "{}");
    } catch (error) {
      console.error("❌ Invalid JSON in message body:", error);
      await sendErrorToConnection(connectionId, "Invalid JSON format");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Invalid JSON handled" }),
      };
    }

    console.log(`📥 Received message for connection ${connectionId}:`, message);

    // Route message based on action
    switch (message.action) {
      case "subscribe":
        await handleSubscribe(connectionId, message);
        break;

      case "unsubscribe":
        await handleUnsubscribe(connectionId, message);
        break;

      case "ping":
        await handlePing(connectionId, message);
        break;

      default:
        console.warn(`⚠️ Unknown action: ${message.action}`);
        await sendErrorToConnection(
          connectionId,
          `Unknown action: ${message.action}`,
          message.requestId
        );
        break;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message processed" }),
    };
  } catch (error) {
    console.error("❌ WebSocket route error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Message processing failed" }),
    };
  }
};

/**
 * Handle subscription to generation updates
 */
async function handleSubscribe(
  connectionId: string,
  message: WebSocketMessage
): Promise<void> {
  try {
    const { queueId } = message.data || {};

    if (!queueId) {
      await sendErrorToConnection(
        connectionId,
        "queueId is required for subscription",
        message.requestId
      );
      return;
    }

    // Verify connection exists
    const getConnectionResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: "METADATA",
        },
      })
    );

    if (!getConnectionResult.Item) {
      await sendErrorToConnection(
        connectionId,
        "Connection not found",
        message.requestId
      );
      return;
    }

    // Verify queue entry exists
    const queueEntry = await queueService.getQueueEntry(queueId);
    if (!queueEntry) {
      await sendErrorToConnection(
        connectionId,
        "Queue entry not found",
        message.requestId
      );
      return;
    }

    // Update queue entry with connection ID
    await queueService.updateQueueEntry(queueId, {
      connectionId: connectionId,
    });

    // Send confirmation
    await sendMessageToConnection(connectionId, {
      type: "subscription_confirmed",
      queueId,
      requestId: message.requestId,
    });

    console.log(`✅ Subscribed connection ${connectionId} to queue ${queueId}`);
  } catch (error) {
    console.error(`❌ Subscribe error for ${connectionId}:`, error);
    await sendErrorToConnection(
      connectionId,
      "Subscription failed",
      message.requestId
    );
  }
}

/**
 * Handle unsubscription from generation updates
 */
async function handleUnsubscribe(
  connectionId: string,
  message: WebSocketMessage
): Promise<void> {
  try {
    const { queueId } = message.data || {};

    if (!queueId) {
      await sendErrorToConnection(
        connectionId,
        "queueId is required for unsubscription",
        message.requestId
      );
      return;
    }

    // Verify queue entry exists and connection matches
    const queueEntry = await queueService.getQueueEntry(queueId);
    if (!queueEntry) {
      await sendErrorToConnection(
        connectionId,
        "Queue entry not found",
        message.requestId
      );
      return;
    }

    // Only remove connection ID if it matches the current connection
    if (queueEntry.connectionId === connectionId) {
      await queueService.updateQueueEntry(queueId, {
        connectionId: undefined,
      });
    }

    // Send confirmation
    await sendMessageToConnection(connectionId, {
      type: "unsubscription_confirmed",
      queueId,
      requestId: message.requestId,
    });

    console.log(
      `✅ Unsubscribed connection ${connectionId} from queue ${queueId}`
    );
  } catch (error) {
    console.error(`❌ Unsubscribe error for ${connectionId}:`, error);
    await sendErrorToConnection(
      connectionId,
      "Unsubscription failed",
      message.requestId
    );
  }
}

/**
 * Handle ping message for connection health check
 */
async function handlePing(
  connectionId: string,
  message: WebSocketMessage
): Promise<void> {
  try {
    // Update last activity
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: "METADATA",
        },
        UpdateExpression: "SET lastActivity = :time",
        ExpressionAttributeValues: {
          ":time": new Date().toISOString(),
        },
      })
    );

    // Send pong response
    await sendMessageToConnection(connectionId, {
      type: "pong",
      timestamp: new Date().toISOString(),
      requestId: message.requestId,
    });
  } catch (error) {
    console.error(`❌ Ping error for ${connectionId}:`, error);
  }
}

/**
 * Send a message to a WebSocket connection
 */
async function sendMessageToConnection(
  connectionId: string,
  data: any
): Promise<void> {
  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    });

    await apiGatewayClient.send(command);
    console.log(
      `📤 Sent message to connection ${connectionId}:`,
      data.type || "unknown"
    );
  } catch (error: any) {
    console.error(`❌ Failed to send message to ${connectionId}:`, error);

    // If connection is gone, clean it up
    if (error.name === "GoneException") {
      console.log(`🧹 Cleaning up stale connection ${connectionId}`);
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `CONNECTION#${connectionId}`,
              SK: "METADATA",
            },
          })
        );
      } catch (cleanupError) {
        console.error(
          `❌ Failed to cleanup connection ${connectionId}:`,
          cleanupError
        );
      }
    }

    throw error;
  }
}

/**
 * Send an error message to a WebSocket connection
 */
async function sendErrorToConnection(
  connectionId: string,
  errorMessage: string,
  requestId?: string
): Promise<void> {
  try {
    await sendMessageToConnection(connectionId, {
      type: "error",
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Failed to send error to ${connectionId}:`, error);
  }
}

/**
 * Broadcast a message to the subscriber of a queue (using queue entry connectionId)
 */
export async function broadcastToQueueSubscribers(
  queueId: string,
  data: any
): Promise<void> {
  try {
    // Get the queue entry to find the connection ID
    const queueEntry = await queueService.getQueueEntry(queueId);

    if (!queueEntry || !queueEntry.connectionId) {
      console.log(`📭 No subscriber found for queue ${queueId}`);
      return;
    }

    // Send message to the subscriber
    try {
      await sendMessageToConnection(queueEntry.connectionId, {
        type: "generation_update",
        queueId,
        data,
        timestamp: new Date().toISOString(),
      });
      console.log(
        `📢 Broadcast message to subscriber ${queueEntry.connectionId} of queue ${queueId}`
      );
    } catch (error) {
      console.error(
        `❌ Failed to send to subscriber ${queueEntry.connectionId}:`,
        error
      );

      // If connection is gone, remove it from the queue entry
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "GoneException"
      ) {
        console.log(
          `🧹 Removing stale connection ${queueEntry.connectionId} from queue ${queueId}`
        );
        try {
          await queueService.updateQueueEntry(queueId, {
            connectionId: undefined,
          });
        } catch (cleanupError) {
          console.error(
            `❌ Failed to cleanup connection from queue ${queueId}:`,
            cleanupError
          );
        }
      }
    }
  } catch (error) {
    console.error(`❌ Failed to broadcast to queue ${queueId}:`, error);
    throw error;
  }
}

/**
 * Broadcast a message to all subscribers of a queue by looking up the queue from ComfyUI prompt ID
 * This is a helper function for compatibility with existing job handlers that use promptId
 */
export async function broadcastToQueueSubscribersByPromptId(
  promptId: string,
  data: any
): Promise<void> {
  try {
    // Find the queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    // Use the found queueId to broadcast to subscribers
    await broadcastToQueueSubscribers(queueEntry.queueId, data);
  } catch (error) {
    console.error(
      `❌ Failed to broadcast to queue subscribers by prompt ID ${promptId}:`,
      error
    );
    throw error;
  }
}
