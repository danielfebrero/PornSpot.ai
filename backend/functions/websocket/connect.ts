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
import { ParameterStoreService } from "@shared/utils/parameters";
import jwt from "jsonwebtoken";
import { createHash, createDecipheriv } from "crypto";

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

// Constants for decryption
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Decrypts the userId using AES-256-GCM decryption
 */
const decryptUserId = (encryptedData: string, secretKey: string): string => {
  try {
    // Create a hash of the secret key to ensure it's 32 bytes
    const key = createHash("sha256").update(secretKey).digest();

    // Split the encrypted data: iv:authTag:encrypted
    const parts = encryptedData.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    // Create decipher
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    console.log("✅ UserId decrypted successfully");
    return decrypted;
  } catch (error) {
    console.error("❌ Failed to decrypt userId:", error);
    throw new Error("Decryption failed");
  }
};

/**
 * Validates and decrypts a JWT token to extract userId
 */
const validateJwtToken = async (token: string): Promise<string | null> => {
  try {
    // Get JWT secret and encryption key from Parameter Store
    const [jwtSecret, encryptionKey] = await Promise.all([
      ParameterStoreService.getJwtSecret(),
      ParameterStoreService.getJwtEncryptionKey(),
    ]);

    // Verify the JWT token
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
      issuer: "pornspot.ai",
    }) as any;

    if (!decoded.encryptedUserId) {
      throw new Error("No encrypted userId in token");
    }

    // Decrypt the userId
    const userId = decryptUserId(decoded.encryptedUserId, encryptionKey);

    console.log("✅ JWT token validated and userId decrypted successfully");
    return userId;
  } catch (error) {
    console.error("❌ JWT token validation failed:", error);
    return null;
  }
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("WebSocket connection request:", JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId!;
  const queryParams = event.queryStringParameters || {};

  try {
    // Extract and validate JWT token
    const jwtToken = queryParams["token"];
    if (!jwtToken) {
      console.log("❌ No JWT token provided");
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "JWT token required" }),
      };
    }

    // Validate JWT token and extract userId
    const userId = await validateJwtToken(jwtToken);
    if (!userId) {
      console.log("❌ Invalid JWT token");
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid JWT token" }),
      };
    }

    console.log(`✅ WebSocket connection authenticated for user: ${userId}`);

    // Create connection entity following the proper schema
    const currentTime = new Date().toISOString();
    const connectionEntity: ConnectionEntity = {
      PK: `CONNECTION#${connectionId}`,
      SK: "METADATA",
      GSI1PK: "WEBSOCKET_CONNECTIONS",
      GSI1SK: `${userId}#${connectionId}`,
      EntityType: "WebSocketConnection",
      connectionId,
      userId,
      connectedAt: currentTime,
      lastActivity: currentTime,
      ttl: Math.floor(Date.now() / 1000) + 86400, // 24 hours TTL
    };

    // Store the connection in DynamoDB
    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: connectionEntity,
    });

    await docClient.send(putCommand);

    console.log(
      `✅ WebSocket connection stored for user ${userId} with connectionId ${connectionId}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Connected" }),
    };
  } catch (error) {
    console.error("❌ Error establishing WebSocket connection:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
