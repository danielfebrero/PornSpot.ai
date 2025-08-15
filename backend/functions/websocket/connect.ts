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
import { ConnectionEntity } from "@shared/shared-types/websocket";
import { JWTService } from "@shared/utils/jwt";

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

    // Extract user info from session token in query parameters or cookies
    let userId: string | undefined;

    try {
      // Check for JWT token in query parameters first
      const queryParams = event.queryStringParameters || {};
      const jwtToken = queryParams["token"];

      if (jwtToken) {
        console.log("🔑 Found JWT token in query parameters");

        try {
          // Verify and decode JWT token to extract userId
          const decoded = await JWTService.verifyToken(jwtToken);
          userId = decoded.userId;
          console.log("✅ JWT token validated successfully, userId:", userId);
        } catch (jwtError) {
          console.error("❌ JWT token validation failed:", jwtError);
          // Continue as anonymous connection if JWT validation fails
          console.log("⚠️ Continuing as anonymous connection due to invalid JWT");
        }
      } else {
        console.log("🔓 No JWT token found in query parameters");
      }
    } catch (error) {
      console.log("⚠️ Session validation error, treating as anonymous:", error);
      // Continue without userId (anonymous connection)
    }

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
