/*
File objective: Handle WebSocket disconnection events
Auth: Public (connection termination)
Special notes:
- Removes connection information from DynamoDB
- Cleans up any active generation sessions for the connection
- Logs disconnection for monitoring
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GenerationQueueService } from "@shared/services/generation-queue";

// Initialize generation queue service
const queueService = GenerationQueueService.getInstance();

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔌 WebSocket disconnect event:", JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      console.error("❌ No connection ID provided");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No connection ID" }),
      };
    }

    // Try to get connection info before deleting
    let connectionInfo;
    try {
      const getResult = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `CONNECTION#${connectionId}`,
            SK: "METADATA",
          },
        })
      );
      connectionInfo = getResult.Item;
    } catch (error) {
      console.warn(
        `⚠️ Connection ${connectionId} not found in database, may have already been cleaned up`
      );
    }

    // Delete connection from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: "METADATA",
        },
      })
    );

    // Clean up any active generation sessions for this connection
    await cleanupActiveGenerations(connectionId);

    // Clean up any queue entries that have this connection ID
    await cleanupQueueSubscriptions(connectionId);

    const userId = connectionInfo?.["userId"];
    console.log(
      `✅ WebSocket connection disconnected: ${connectionId}${
        userId ? ` for user ${userId}` : " (anonymous)"
      }`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Disconnected",
        connectionId,
      }),
    };
  } catch (error) {
    console.error("❌ WebSocket disconnect error:", error);
    // Don't fail disconnection even if cleanup fails
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Disconnected" }),
    };
  }
};

/**
 * Clean up any active generation sessions for the disconnected connection
 */
async function cleanupActiveGenerations(connectionId: string): Promise<void> {
  try {
    // Query for any active generation sessions for this connection
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": "ACTIVE_GENERATIONS",
          ":sk": connectionId,
        },
      })
    );

    // Mark generations as disconnected
    const updatePromises = (queryResult.Items || []).map(
      async (generation: any) => {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: generation.PK,
              SK: generation.SK,
            },
            UpdateExpression: "SET #status = :status, disconnectedAt = :time",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":status": "disconnected",
              ":time": new Date().toISOString(),
            },
          })
        );
      }
    );

    await Promise.allSettled(updatePromises);

    if (queryResult.Items && queryResult.Items.length > 0) {
      console.log(
        `🧹 Cleaned up ${queryResult.Items.length} active generation(s) for connection ${connectionId}`
      );
    }
  } catch (error) {
    console.error(
      `❌ Failed to cleanup active generations for ${connectionId}:`,
      error
    );
    // Don't throw error as disconnection should still succeed
  }
}

/**
 * Clean up any queue entries that have this connection ID
 */
async function cleanupQueueSubscriptions(connectionId: string): Promise<void> {
  try {
    // Query for any pending/processing queue entries with this connection ID
    // We need to check multiple statuses as the queue entry might be in different states
    const statuses = ["pending", "processing"];

    for (const status of statuses) {
      const queryResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :statusKey",
          FilterExpression: "connectionId = :connectionId",
          ExpressionAttributeValues: {
            ":statusKey": `QUEUE#STATUS#${status}`,
            ":connectionId": connectionId,
          },
        })
      );

      // Remove connection ID from matching queue entries
      const updatePromises = (queryResult.Items || []).map(
        async (queueItem: any) => {
          const queueId = queueItem.queueId;
          if (queueId) {
            await queueService.updateQueueEntry(queueId, {
              connectionId: undefined,
            });
            console.log(
              `🧹 Removed connection ${connectionId} from queue ${queueId}`
            );
          }
        }
      );

      await Promise.allSettled(updatePromises);
    }
  } catch (error) {
    console.error(
      `❌ Failed to cleanup queue subscriptions for ${connectionId}:`,
      error
    );
    // Don't throw error as disconnection should still succeed
  }
}
