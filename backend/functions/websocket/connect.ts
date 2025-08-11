/*
File objective: Handle WebSocket connection events
Auth: Public (connection establishment)
Special notes:
- Stores connection information in DynamoDB for message routing
- Validates connection and stores user info if authenticated
- Sets up connection tracking for cleanup
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

interface ConnectionEntity {
  PK: string; // CONNECTION#{connectionId}
  SK: string; // METADATA
  GSI1PK: string; // WEBSOCKET_CONNECTIONS
  GSI1SK: string; // {userId}#{connectionId} or ANONYMOUS#{connectionId}
  EntityType: "WebSocketConnection";
  connectionId: string;
  userId?: string;
  connectedAt: string;
  lastActivity: string;
  ttl: number; // TTL for automatic cleanup after 24 hours
}

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
  console.log("🔗 WebSocket connect event:", JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      console.error("❌ No connection ID provided");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No connection ID" }),
      };
    }

    // Extract user info from query parameters or headers if available
    const queryParams = event.queryStringParameters || {};
    const userId = queryParams["userId"]; // Frontend can pass user ID if authenticated

    const now = new Date();
    const nowString = now.toISOString();
    const ttl = Math.floor(now.getTime() / 1000) + 24 * 60 * 60; // 24 hours TTL

    // Create connection entity
    const connectionEntity: ConnectionEntity = {
      PK: `CONNECTION#${connectionId}`,
      SK: "METADATA",
      GSI1PK: "WEBSOCKET_CONNECTIONS",
      GSI1SK: userId
        ? `${userId}#${connectionId}`
        : `ANONYMOUS#${connectionId}`,
      EntityType: "WebSocketConnection",
      connectionId,
      userId,
      connectedAt: nowString,
      lastActivity: nowString,
      ttl,
    };

    // Store connection in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: connectionEntity,
      })
    );

    console.log(
      `✅ WebSocket connection established: ${connectionId}${
        userId ? ` for user ${userId}` : " (anonymous)"
      }`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Connected",
        connectionId,
        userId: userId || null,
      }),
    };
  } catch (error) {
    console.error("❌ WebSocket connect error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Connection failed" }),
    };
  }
};
